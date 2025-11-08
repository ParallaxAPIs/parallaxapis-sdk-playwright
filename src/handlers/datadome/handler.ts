import { Mutex } from "async-mutex";
import fs from "fs";
import { DatadomeSDK, ResponseGetUsage } from "parallaxapis-sdk-ts";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type LaunchOptions,
  type Page,
  type Request,
  type Response,
} from "playwright";
import type { Config } from "../../models/config";
import { SDKHelper } from "../sdk-helper/helper";

const DATADOME_COOKIE_LENGTH = 128;
const defaultMaxRetry = 5;

export type BrowserInitConfig = {
  browserLaunchOptions?: Omit<LaunchOptions, "proxy" | "headless" | "channel">;
  contextLaunchOptions?: Omit<BrowserContextOptions, "userAgent">;
};

export class DatadomeHandler extends SDKHelper {
  private sdk: DatadomeSDK;
  private cfg: Config;
  private blockedRequest: Request | undefined;
  private tagsProcessing: boolean = false;
  private mu: Mutex = new Mutex();
  private blockedResponseHandler?: (response: Response) => Promise<void>;
  private retry: number = 0;

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
  }

  // Init function, it handles everything for a user, you can customize a browser launch options, and browser context launch options
  public static async init(
    config: Config,
    browserInitConfig?: BrowserInitConfig,
  ): Promise<[Page, Browser, BrowserContext, DatadomeHandler]> {
    try {
      const proxyUrl = new URL(config.proxy);

      const sdk = new DatadomeSDK({
        apiKey: config.apiKey,
        apiHost: config.apiHost,
        ...config.sdkConfig,
      });

      const browser = await chromium.launch({
        proxy: {
          server: `${proxyUrl.hostname}:${proxyUrl.port}`,
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

      return [page, browser, context, handler];
    } catch (error) {
      throw new Error(`Failed to initialize DatadomeHandler: ${error}`);
    }
  }

  // Handles datadome block, like captcha or intersitial.
  // after solving, sdk retries blocked request and refreshes a page.
  private async handleBlock(url: string) {
    try {
      this.log("Got blocked, solving datadome...");

      const cookies = await this.ctx.cookies();
      const datadomeCookie = cookies.find(
        (cookie) => cookie.name == "datadome",
      );

      if (!datadomeCookie) throw Error("couldn't find initial datadome cookie");

      const [task, pd] = this.sdk.parseChallengeUrl(url, datadomeCookie.value);

      const solveResult = await this.sdk.generateCookie({
        data: task,
        pd: pd,
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

      this.log(`Successfully solved datadome! [${pd}]`);
    } catch (error) {
      this.log(`Error while handling block: ${error}`);
    }
  }

  public async proxyTraffic() {
    try {
      this.handleCleanup();
      this.replaceTagsCookie();
      this.handleCaptchaRequest();
      this.handleBlockedRoutes();
    } catch (error) {
      this.log(`Error setting up proxy traffic handlers: ${error}`);
      throw error;
    }
  }

  // Saves blocked requests, so we can retry them later
  private async handleBlockedRoutes() {
    this.blockedResponseHandler = async (response: Response) => {
      try {
        if (
          response.status() == 403 &&
          JSON.stringify(await response.json()).includes("captcha-delivery")
        ) {
          this.blockedRequest = response.request();
        }
      } catch {}
    };

    this.ctx.on("response", this.blockedResponseHandler);
  }

  // Blocks a geo captcha page request, for better flow, solves a challange, and retries blocked request.
  private async handleCaptchaRequest() {
    await this.page.route(
      /geo\.captcha\-delivery\.com\/(interstitial|captcha)/gm,
      async (route) => {
        try {
          const request = route.request();

          const blockHandlingPromise = this.handleBlock(request.url());

          await route.fulfill({
            body: fs.readFileSync("./assets/solving.html", "utf-8"),
          });

          await blockHandlingPromise;

          if (this.blockedRequest != undefined) {
            const status = await this.page.evaluate(
              async ({ method, headers, postData, url }) => {
                if (url) {
                  return await fetch(url, {
                    method: method,
                    body: postData,
                    headers: headers,
                  }).then((res) => res.status);
                }
              },
              {
                method: this.blockedRequest.method(),
                headers: this.blockedRequest.headers(),
                postData: this.blockedRequest.postData(),
                url: this.blockedRequest.url(),
              },
            );

            if (!status || status < 200 || status >= 300) {
              this.retry++;
            } else {
              this.retry = 0;
            }

            if (this.retry >= defaultMaxRetry) {
              throw new Error(
                `Exceed maximum solving retry: ${defaultMaxRetry}`,
              );
            }

            this.blockedRequest = undefined;
          }

          await this.page.reload();
        } catch (error) {
          this.log(`Error handling captcha request: ${error}`);
          throw error;
        }
      },
    );
  }

  // Blocks datadome collector script, and replaces response body with cookie from an api.
  private async replaceTagsCookie(): Promise<void> {
    await this.page.route("**/js", async (route) => {
      try {
        const request = route.request();
        const postData = request.postData();

        const release = await this.mu.acquire();

        try {
          if (
            this.tagsProcessing ||
            !postData ||
            request.method() !== "POST" ||
            !postData.includes("ddk")
          ) {
            return await route.continue();
          }

          this.tagsProcessing = true;
        } finally {
          release();
        }

        const response = await this.page.evaluate(
          async ({ url, options }) => {
            try {
              const response = await fetch(url, {
                method: options.method,
                headers: options.headers,
                body: options.body,
              });

              const body = await response.json();

              return {
                success: true,
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body: body,
              };
            } catch {
              return { success: false };
            }
          },
          {
            url: request.url(),
            options: {
              method: request.method(),
              headers: request.headers(),
              body: request.postData(),
            },
          },
        );

        if (!response.success) return route.abort();

        const bodyJson = response.body as { cookie: string };

        const cookies = await this.ctx.cookies();
        const datadomeCookie = cookies.find(
          (cookie) => cookie.name == "datadome",
        );

        const solveResult = await this.sdk.generateDatadomeTagsCookie({
          site: this.cfg.site,
          region: this.cfg.region,
          proxyregion: this.cfg.proxyRegion,
          proxy: this.cfg.proxy,
          data: { cid: datadomeCookie?.value || "null" },
        });

        const template = bodyJson.cookie.slice(
          "datadome=".length + DATADOME_COOKIE_LENGTH,
        );
        const bodyCookie = `${solveResult.message}${template}`;

        this.log("Solved tags payload.");

        await route.fulfill({
          status: response.status,
          headers: response.headers,
          body: JSON.stringify({
            status: response.status,
            cookie: bodyCookie,
          }),
        });
      } catch {
        await route.continue();
      }
    });
  }

  private handleCleanup() {
    this.withBaseCleanup(async () => {
      if (this.blockedResponseHandler)
        this.ctx.off("response", this.blockedResponseHandler);
    });
  }

  public async checkUsage(): Promise<ResponseGetUsage> {
    return await this.sdk.checkUsage(this.cfg.site);
  }
}
