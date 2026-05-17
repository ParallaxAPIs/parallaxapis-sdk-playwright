import { Mutex } from "async-mutex";
import {
  DatadomeSDK,
  ResponseGetUsage,
  TaskGenerateDatadomeCookieData,
  ProductType,
} from "parallaxapis-sdk-ts";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type LaunchOptions,
  type Page,
} from "playwright";
import type { Config } from "../../models/config";
import { HandlerInitValues } from "../../models/init";
import { SDKHelper } from "../sdk-helper/helper";

const defaultMaxApiRetry = 5;

export type BrowserInitConfig = {
  browserLaunchOptions?: Omit<LaunchOptions, "proxy" | "channel">;
  contextLaunchOptions?: Omit<BrowserContextOptions, "userAgent">;
};

export class DatadomeHandler extends SDKHelper {
  private sdk: DatadomeSDK;
  private cfg: Config;
  private tagsProcessing: boolean = false;
  private solving: boolean = false;
  private bvBan: boolean = false;
  private retry: number = 0;
  private mu: Mutex = new Mutex();
  private maxApiRetry: number = defaultMaxApiRetry;
  private disableTagsGeneration: boolean = false;
  private cdpClient: any;

  private constructor(
    config: Config,
    ctx: BrowserContext,
    page: Page,
    browser: Browser,
    sdk: DatadomeSDK,
  ) {
    super(
      "ParallaxAPIs Datadome Handler",
      page,
      browser,
      ctx,
      config.disableLogging || false,
    );

    this.ctx = ctx;
    this.cfg = config;
    this.sdk = sdk;

    if (config.maxApiRetry) this.maxApiRetry = config.maxApiRetry;
    if (config.disableTagsGeneration) this.disableTagsGeneration = config.disableTagsGeneration;
  }

  public static async init(
    config: Config,
    browserInitConfig?: BrowserInitConfig,
  ): Promise<HandlerInitValues<DatadomeSDK, DatadomeHandler>> {
    try {
      const proxyUrl = new URL(config.proxy);

      const sdk = new DatadomeSDK({
        apiKey: config.apiKey,
        apiHost: config.apiHost,
        ...config.sdkConfig,
      });

      const browser = await chromium.launch({
        proxy: {
          server: `${proxyUrl.protocol}//${proxyUrl.hostname}:${proxyUrl.port}`,
          password: proxyUrl.password,
          username: proxyUrl.username,
        },
        headless: false,
        channel: "chrome",
        ...browserInitConfig?.browserLaunchOptions,
      });

      const ua = await sdk.generateUserAgent({
        region: "eu",
        site: config.site,
      });

      const context = await browser.newContext({
        userAgent: ua.UserAgent,
        ...browserInitConfig?.contextLaunchOptions,
      });

      const page = await context.newPage();
      const handler = new DatadomeHandler(config, context, page, browser, sdk);

      await handler.proxyTraffic();

      return {
        browser,
        handler,
        page,
        sdk,
        browserContext: context
      };
    } catch (error) {
      throw new Error(`Failed to initialize DatadomeHandler: ${error}`);
    }
  }

  public async proxyTraffic() {
    try {
      this.handleCleanup();
      await this.setupCDPInterception();
    } catch (error) {
      this.log(`Error setting up proxy traffic handlers: ${error}`);
      throw error;
    }
  }

  private async setupCDPInterception() {
    this.cdpClient = await this.page.context().newCDPSession(this.page);

    const enableFetch = async () => {
      await this.cdpClient.send('Fetch.enable', {
        patterns: [
          { urlPattern: '*', requestStage: 'Response', resourceType: 'XHR' },
          { urlPattern: '*', requestStage: 'Response', resourceType: 'Fetch' },
          { urlPattern: '*/js', requestStage: 'Request' },
          { urlPattern: '*/js/*', requestStage: 'Request' },
          { urlPattern: '*://ct.captcha-delivery.com/c.js*', requestStage: 'Request' },
          { urlPattern: '*://ct.captcha-delivery.com/i.js*', requestStage: 'Request' },
        ]
      });
    };

    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame()) enableFetch().catch(() => {});
    });

    this.cdpClient.on('Fetch.requestPaused', async (event: any) => {
      const { responseStatusCode } = event;

      try {
        if (responseStatusCode !== undefined) {
          await this.handleResponseInterception(event);
        } else {
          await this.handleRequestInterception(event);
        }
      } catch (error) {
        this.log(`Interception error: ${error}`);
        throw error;
        /*try {
          await this.cdpClient.send('Fetch.continueRequest', { requestId });
        } catch { }*/
      }
    });
  }

  private async handleResponseInterception(event: any) {
    const { requestId, request, responseStatusCode } = event;

    if (responseStatusCode !== 403) {
      await this.cdpClient.send('Fetch.continueRequest', { requestId });
      return;
    }

    let body: string;
    try {
      const responseBody = await this.cdpClient.send('Fetch.getResponseBody', { requestId });
      body = responseBody.base64Encoded
        ? Buffer.from(responseBody.body, 'base64').toString('utf-8')
        : responseBody.body;
    } catch (error) {
      this.log(`Failed to get response body: ${error}`);
      await this.cdpClient.send('Fetch.continueRequest', { requestId });
      return;
    }

    const cookies = await this.ctx.cookies();
    const datadomeCookie = cookies.find((cookie) => cookie.name === "datadome");

    const [isBlocked, taskData, productType] = await this.sdk.detectChallengeAndParse(
      body,
      datadomeCookie?.value || ''
    );

    if (!isBlocked || !taskData) {
      await this.cdpClient.send('Fetch.continueRequest', { requestId });
      return;
    }

    //this.log(`Intercepted 403 DataDome block for XHR/Fetch: ${request.url}`);

    try {
      await this.solveChallenge(taskData, productType!);

      const retryResponse = await this.retryRequestWithNewCookie(request);

      await this.cdpClient.send('Fetch.fulfillRequest', {
        requestId,
        responseCode: retryResponse.status,
        responseHeaders: this.formatHeadersForCDP(retryResponse.headers),
        body: Buffer.from(retryResponse.body).toString('base64'),
      });

      //this.log(`Successfully fulfilled request with solved response: ${request.url} (status: ${retryResponse.status})`);

    } catch (error) {
      //this.log(`Failed to solve block, returning original 403: ${error}`);
      await this.cdpClient.send('Fetch.continueRequest', { requestId });
      throw error;
    }
  }

  private async handleRequestInterception(event: any) {
    const { requestId, request } = event;
    const url = request.url;

    if (url.includes('ct.captcha-delivery.com') && (url.includes('/c.js') || url.includes('/i.js'))) {
      try {
        await this.handleDocumentLevelBlock(event);
        return;
      } catch (error) {
        throw error;
      }
    }

    const postData = request.postData || '';
    const isTagsRequest = request.method === 'POST' && postData.includes('&ddk=');

    if (!isTagsRequest) {
      await this.cdpClient.send('Fetch.continueRequest', { requestId });
      return;
    }

    const release = await this.mu.acquire();
    if (
      this.tagsProcessing ||
      this.disableTagsGeneration ||
      postData.includes('jsType=le') ||
      this.solving
    ) {
      release();
      await this.cdpClient.send('Fetch.failRequest', {
        requestId,
        errorReason: 'Aborted'
      });
      return;
    }

    this.tagsProcessing = true;
    release();

    try {
      const cookies = await this.ctx.cookies();
      const datadomeCookie = cookies.find((cookie) => cookie.name === "datadome");

      const solveResult = await this.sdk.generateDatadomeTagsCookie({
        site: this.cfg.site,
        region: this.cfg.region,
        proxyregion: this.cfg.proxyRegion,
        proxy: this.cfg.proxy,
        data: { cid: datadomeCookie?.value || 'null' },
      });

      if (!solveResult.message) {
        throw new Error("Generation failed");
      }

      if (solveResult.message?.includes('tadome=')) {
        this.log('Solved tags payload.');
        const solvedPair = solveResult.message.split(';')[0];
        const [, cookieValue] = solvedPair.split('=');
        await this.replaceCookie('datadome', cookieValue, await this.getOrigin());
      } else {
        throw new Error(solveResult.message);
      }

      await this.cdpClient.send('Fetch.failRequest', {
        requestId,
        errorReason: 'Aborted'
      });
    } catch (error) {
      this.log(`Tags generation error: ${error}`);
      await this.cdpClient.send('Fetch.failRequest', {
        requestId,
        errorReason: 'Aborted'
      });
    } finally {
      this.tagsProcessing = false;
    }
  }

  private async handleDocumentLevelBlock(event: any) {
    const { requestId } = event;

    //this.log('Intercepted c.js/i.js - document-level block detected');

    await this.cdpClient.send('Fetch.failRequest', {
      requestId,
      errorReason: 'Aborted'
    });

    try {
      const ddData = await this.page.evaluate(() => {
        return (window as any).dd;
      });

      if (!ddData) {
        throw new Error('Could not find dd object in page');
      }

      const cookies = await this.ctx.cookies();
      const datadomeCookie = cookies.find((cookie) => cookie.name === "datadome");

      const htmlBody = `<html><script>var dd=${JSON.stringify(ddData)}</script></html>`;

      const [taskData, productType] = await this.sdk.parseChallengeHtml(
        htmlBody,
        datadomeCookie?.value || ''
      );

      if (!taskData) {
        throw new Error('Failed to parse challenge from dd object');
      }

      await this.solveChallenge(taskData, productType!);

      await this.page.reload();

    } catch (error) {
      //this.log(`Error handling document-level block: ${error}`);
      throw error;
    }
  }

  private async retryRequestWithNewCookie(originalRequest: any): Promise<{
    status: number;
    headers: Record<string, string>;
    body: string;
  }> {
    const cookies = await this.ctx.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    let creds = false;

    const headers: Record<string, string> = { ...originalRequest.headers };
    if (headers['x-datadome-clientid']) {
      let val = cookieHeader.split('datadome=')[1]
      if (val.includes(';')) val = val.split(';')[0]

      //header wont override, need to use iframe to actually send the new one
      headers['x-datadome-clientid'] = val;
    }
    else {
      headers['cookie'] = cookieHeader;
      creds = true;
    }

    const response = await this.page.evaluate(
      async ({ url, method, headers, postData, creds }) => {
        try {
          let options: RequestInit = {
            method,
            headers,
            body: postData || undefined,

          }

          if (creds) {
            options.credentials = 'include';
          }else{
            return {
              status: 200,
              headers: {},
              body: 'Bypass',
            }
          }

          const resp = await fetch(url, options);

          const responseHeaders: Record<string, string> = {};
          resp.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });

          const body = await resp.text();

          return {
            status: resp.status,
            headers: responseHeaders,
            body,
          };
        } catch (error) {
          throw new Error(`Retry fetch failed: ${error}`);
        }
      },
      {
        url: originalRequest.url,
        method: originalRequest.method,
        headers,
        postData: originalRequest.postData,
        creds,
      }
    );

    return response;
  }

  private formatHeadersForCDP(headers: Record<string, string>): Array<{ name: string; value: string }> {
    return Object.entries(headers).map(([name, value]) => ({ name, value }));
  }

  private async solveChallenge(taskData: TaskGenerateDatadomeCookieData, productType: ProductType): Promise<void> {
    if (this.solving) return;

    try {
      this.solving = true;

      for (let retryCount = 0; retryCount < this.maxApiRetry; retryCount++) {
        try {
          this.log("Got blocked, solving datadome...");

          const solveResult = await this.sdk.generateCookie({
            data: taskData,
            pd: productType,
            proxy: this.cfg.proxy,
            proxyregion: this.cfg.proxyRegion,
            region: this.cfg.region,
            site: this.cfg.site,
          });

          if (solveResult.error)
            throw new Error(
              solveResult.message ? solveResult.message : solveResult.cookie,
            );

          if (!solveResult.message) throw new Error("api didn't return any cookie");

          const [cookieName, cookieValue] = solveResult.message.split("=");

          if (!cookieName || !cookieValue)
            throw new Error("api returned malformed cookie");

          await this.replaceCookie(cookieName, cookieValue, await this.getOrigin());

          this.log(`Successfully solved datadome! [${productType}]`);

          this.retry = 0;

          return;
        } catch (error) {
          this.retry++;
          this.log(`Error while handling block: ${error}`);

          if (!(error instanceof Error)) continue;
          if (error.message.includes("t=bv")) {
            this.bvBan = true;
            throw new Error('t=bv; hard ban, IP/Flow related issue.');
          }
        }
      }
    } finally {
      if (this.retry === this.maxApiRetry && !this.bvBan) {
        throw new Error(`Exceeded maximum solving retries: ${this.maxApiRetry}`);
      }

      this.solving = false;
    }
  }

  private handleCleanup() {
    this.withBaseCleanup(async () => {
      if (this.cdpClient) {
        try {
          await this.cdpClient.send('Fetch.disable');
          await this.cdpClient.detach();
        } catch { }
      }
    });
  }

  public async checkUsage(): Promise<ResponseGetUsage> {
    return await this.sdk.checkUsage(this.cfg.site);
  }
}