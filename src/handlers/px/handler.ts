import { Mutex } from "async-mutex";
import fs from "fs";
import type {
  GeneratePxCookiesResponse,
  ResponseGetUsage,
} from "parallaxapis-sdk-ts";
import { PerimeterxSDK } from "parallaxapis-sdk-ts";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import type { Config } from "../../models/config";
import { HandlerInitValues } from "../../models/init";
import type { BrowserInitConfig } from "../datadome/handler";
import { SDKHelper } from "../sdk-helper/helper";

const defaultMaxApiRetry = 5;
const initGenerationIntervalTimeout = 1000 * 60 * 4;

export class PerimeterxHandler extends SDKHelper {
  private sdk: PerimeterxSDK;
  private cfg: Config;
  private pxData: GeneratePxCookiesResponse = {} as GeneratePxCookiesResponse;
  private fallbackOrigin: string;
  //private captchaSolvingMu: Mutex = new Mutex();
  private initGenerationInterval?: NodeJS.Timeout;
  private maxApiRetry: number = defaultMaxApiRetry;
  private solving: boolean = false;
  private retry: number = 0;
  private cdpClient: any;

  private constructor(
    config: Config,
    ctx: BrowserContext,
    page: Page,
    browser: Browser,
    sdk: PerimeterxSDK,
    fallbackOrigin: string,
  ) {
    super(
      "ParallaxAPIs PerimeterX Handler",
      page,
      browser,
      ctx,
      config.disableLogging || false,
    );

    this.ctx = ctx;
    this.cfg = config;
    this.sdk = sdk;
    this.fallbackOrigin = fallbackOrigin;

    if (config.maxApiRetry) this.maxApiRetry = config.maxApiRetry;
  }

  public static async init(
    config: Config & { websiteUrl: string },
    browserInitConfig?: BrowserInitConfig,
  ): Promise<HandlerInitValues<PerimeterxSDK, PerimeterxHandler>> {
    try {
      const proxyUrl = new URL(config.proxy);

      const sdk = new PerimeterxSDK({
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
        channel: "chrome",
        ...browserInitConfig?.browserLaunchOptions,
      });

      //generate first cookie
      const result = await sdk.generateCookies({
        proxy: config.proxy,
        proxyregion: config.proxyRegion,
        region: config.region,
        site: config.site,
      });

      const context = await browser.newContext({
        userAgent: result.UserAgent,
        ...browserInitConfig?.contextLaunchOptions,
      });

      if (!result.cookie.startsWith("HoldCaptcha")) {
        const [cookieName, cookieValue] = result.cookie.split("=");

        if (!cookieName || !cookieValue)
          throw new Error("Api responded with malformed cookie");

        const url = new URL(config.websiteUrl);
        const domain = url.hostname.split(".").length > 2
          ? url.hostname.split(".").slice(1).join(".")
          : url.hostname;

        // Set expiry to 24 hours from now
        const expiryDate = Math.floor(Date.now() / 1000) + (60 * 60 * 24); // Unix timestamp in seconds

        await context.addCookies([
          {
            name: cookieName,
            value: cookieValue,
            domain: `.${domain}`,
            path: '/',
            expires: expiryDate, // prevents losing cookie ctx on domain change;
            secure: true,
            sameSite: 'Lax',
          },
        ]);
      }

      const page = await context.newPage();

      const handler = new PerimeterxHandler(
        config,
        context,
        page,
        browser,
        sdk,
        new URL(config.websiteUrl).origin,
      );

      handler.pxData = result;
      handler.log("Init generation successful!");

      await handler.proxyTraffic();

      return {
        browser,
        handler,
        page,
        sdk,
        browserContext: context
      };
    } catch (error) {
      throw new Error(`Failed to initialize PerimeterxHandler: ${error}`);
    }
  }

  private isCollectorRequest(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      return (
        pathname.endsWith('/collector') ||
        pathname.endsWith('/b/s') ||
        pathname.includes('/xhr/') ||
        pathname.includes('/api/')
      );
    } catch {
      return false;
    }
  }

  private isBundleRequest(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      return pathname.endsWith('/bundle') ||
        pathname.includes('/bundle/') ||
        pathname.endsWith('/res/uc') ||
        pathname.includes('/res/uc/');
    } catch {
      return false;
    }
  }

  private async solveCaptcha() {
    if (this.solving) return;

    try {
      this.solving = true;

      for (let retry = 0; retry < this.maxApiRetry; retry++) {
        try {
          this.log("Solving captcha...");

          const result = await this.sdk.generateHoldCaptcha({
            proxy: this.cfg.proxy,
            proxyregion: this.cfg.proxyRegion,
            region: this.cfg.region,
            site: this.cfg.site,
            data: this.pxData.data,
          });

          //this.log("Got captcha response from api!");

          const [cookieName, cookieValue] = result.cookie.split("=");

          if (!cookieName || !cookieValue)
            throw new Error("Api responded with malformed cookie");

          let origin = await this.getOrigin();
          if (origin.length === 0) origin = this.fallbackOrigin;

          await this.replaceCookie(cookieName, cookieValue, origin);

          this.log("Captcha solved!");
          this.retry = 0;

          return result;
        } catch (error) {
          this.retry++;
          this.log(`Error solving captcha: ${error}`);
        }
      }
    } finally {
      if (this.retry >= this.maxApiRetry) {
        throw new Error(`Exceeded maximum solving retries: ${this.maxApiRetry}`);
      }
      this.solving = false;
    }
  }

  private async solveInit() {
    try {
      for (let retry = 0; retry < this.maxApiRetry; retry++) {
        this.log("Solving init...");

        const result = await this.sdk.generateCookies({
          proxy: this.cfg.proxy,
          proxyregion: this.cfg.proxyRegion,
          region: this.cfg.region,
          site: this.cfg.site,
        });

        if (!result.cookie.startsWith("HoldCaptcha")) {
          const [cookieName, cookieValue] = result.cookie.split("=");

          if (!cookieName || !cookieValue)
            throw new Error("Api responded with malformed cookie");

          let origin = await this.getOrigin();
          if (origin.length === 0) origin = this.fallbackOrigin;

          await this.replaceCookie(cookieName, cookieValue, origin);
        }

        this.log("Init generation successful!");

        return result;
      }
    } catch (error) {
      this.log(`Error solving init: ${error}`);
      throw error;
    }
  }

  private async startInitGenerationInterval() {
    try {
      this.page.once("load", async () => {
        this.initGenerationInterval = setInterval(async () => {
          try {
            const initResult = await this.solveInit();

            if (!initResult) {
              throw new Error("Api returned empty init result");
            }

            this.pxData = initResult;
          } catch (error) {
            this.log(`Error while generating init cookie: ${error}`);
          }
        }, initGenerationIntervalTimeout);
      });
    } catch (error) {
      this.log(`Error starting init generation interval: ${error}`);
      throw error;
    }
  }

  public async proxyTraffic() {
    try {
      this.handleCleanup();
      await this.startInitGenerationInterval();
      await this.handleBundleRequest();
      await this.handleCollectorBlock_CDP();
    } catch (error) {
      this.log(`Error setting up proxy traffic handlers: ${error}`);
      throw error;
    }
  }

  private async handleCollectorBlock_CDP() {
    this.cdpClient = await this.page.context().newCDPSession(this.page);

    const enableFetch = async () => {
      await this.cdpClient.send('Fetch.enable', {
        patterns: [
          { urlPattern: '*/collector', requestStage: 'Request' },
          { urlPattern: '*/b/s', requestStage: 'Request' },
          { urlPattern: '*/collector/*', requestStage: 'Request' }
        ]
      });
    };

    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame()) enableFetch().catch(() => {});
    });

    this.cdpClient.on('Fetch.requestPaused', async (event: any) => {
      const { requestId, request } = event;

      try {
        const postData = request.postData || '';
        const isTargetRequest =
          request.method === 'POST' &&
          postData.includes('payload=');

        if (this.isCollectorRequest(request.url) && isTargetRequest) {
          //this.log("Blocked collector request via CDP.");
          await this.cdpClient.send('Fetch.failRequest', {
            requestId,
            errorReason: 'Aborted'
          });
          return;
        }

        await this.cdpClient.send('Fetch.continueRequest', { requestId });
      } catch (error) {
        try {
          await this.cdpClient.send('Fetch.failRequest', {
            requestId,
            errorReason: 'Aborted'
          });
        } catch { }
      }
    });
  }

  private async handleBundleRequest() {
    const solvingHtml = fs.readFileSync("./assets/solving.html", "utf-8");
    const solvingDataUrl = `data:text/html;base64,${Buffer.from(solvingHtml).toString('base64')}`;

    await this.page.route(
      (url) => this.isBundleRequest(url.toString()),
      async (route) => {
        try {
          await route.abort();

          if (this.solving) return;

          //this.log(`Intercepted bundle request: ${route.request().url()}`);

          const currentUrl = this.page.url();

          await this.page.goto(solvingDataUrl);

          await this.solveCaptcha();

          await this.page.goto(currentUrl);
        } catch (error) {
          this.log(`Error handling bundle request: ${error}`);
          throw error;
        }
      },
    );
  }

  private handleCleanup() {
    this.withBaseCleanup(async () => {
      if (this.initGenerationInterval)
        clearInterval(this.initGenerationInterval);

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