import type { GeneratePxCookiesResponse } from "parallaxapis-sdk-ts";
import { PerimeterxSDK } from "parallaxapis-sdk-ts";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
  type Response,
} from "playwright";
import type { Config } from "../../models/config";
import type { BrowserInitConfig } from "../datadome/handler";
import { SDKHelper } from "../sdk-helper/helper";
import { Mutex } from "async-mutex";
import delay from "delay";

const collectorScriptUrlRe = /(?:http|https):\/\/(?=.*px)(?=.*collector).*/i;
const captchaRequestRe = /https?.*(captcha\.js).*(u=)/i;

const initGenerationIntervalTimeout = 1000 * 60 * 4;

export default class PerimeterxHandler extends SDKHelper {
  private sdk: PerimeterxSDK;
  private cfg: Config;
  private pxData: GeneratePxCookiesResponse = {} as GeneratePxCookiesResponse;
  private fallbackOrigin: string;
  private captchaSolvingMu: Mutex = new Mutex();
  private initGenerationInterval?: NodeJS.Timeout;
  private captchaResponseHandler?: (response: Response) => Promise<void>;

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
  }

  public static async init(
    config: Config & { websiteUrl: string },
    browserInitConfig?: BrowserInitConfig,
  ): Promise<[Page, Browser, BrowserContext, PerimeterxHandler]> {
    try {
      const proxyUrl = new URL(config.proxy);

      const sdk = new PerimeterxSDK({
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

      const context = await browser.newContext({
        ...browserInitConfig?.contextLaunchOptions,
      });

      const page = await context.newPage();

      const handler = new PerimeterxHandler(
        config,
        context,
        page,
        browser,
        sdk,
        new URL(config.websiteUrl).origin,
      );

      await handler.proxyTraffic();

      return [page, browser, context, handler];
    } catch (error) {
      throw new Error(`Failed to initialize PerimeterxHandler: ${error}`);
    }
  }

  private async solveCaptcha() {
    if (this.captchaSolvingMu.isLocked()) return;

    const release = await this.captchaSolvingMu.acquire();

    try {
      this.log("Solving captcha...");

      const result = await this.sdk.generateHoldCaptcha({
        proxy: this.cfg.proxy,
        proxyregion: this.cfg.proxyRegion,
        region: this.cfg.region,
        site: this.cfg.site,
        data: this.pxData.data,
      });

      this.log("Got captcha response from api!");

      const [cookieName, cookieValue] = result.cookie.split("=");

      if (!cookieName || !cookieValue)
        throw new Error("Api responded with malformed cookie");

      await this.ctx.clearCookies({ name: cookieName });
      await this.ctx.addCookies([
        {
          name: cookieName,
          value: cookieValue,
          url: await this.getOrigin(),
        },
      ]);

      this.log("Captcha solved!");

      return result;
    } catch (error) {
      this.log(`Error solving captcha: ${error}`);
      throw error;
    } finally {
      await delay(1000);
      await this.page.reload();
      release();
    }
  }

  private async solveInit() {
    try {
      this.log("Solving init...");

      const result = await this.sdk.generateCookies({
        proxy: this.cfg.proxy,
        proxyregion: this.cfg.proxyRegion,
        region: this.cfg.region,
        site: this.cfg.site,
      });

      const [cookieName, cookieValue] = result.cookie.split("=");

      if (!cookieName || !cookieValue)
        throw new Error("Api responded with malformed cookie");

      let origin = await this.getOrigin();
      if (origin.length === 0) origin = this.fallbackOrigin;

      await this.ctx.clearCookies({ name: cookieName });
      await this.ctx.addCookies([
        {
          name: cookieName,
          value: cookieValue,
          url: origin,
        },
      ]);

      this.log("Init solved...");

      return result;
    } catch (error) {
      this.log(`Error solving init: ${error}`);
      throw error;
    }
  }

  private async startInitGenerationInterval() {
    try {
      this.pxData = await this.solveInit();

      this.page.once("load", async () => {
        this.initGenerationInterval = setInterval(async () => {
          try {
            this.pxData = await this.solveInit();
          } catch (error) {
            this.log(`Error while generating inti cookie: ${error}`);
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

      this.handleCaptchaBlockedRoutes();
      this.handleCollectorScriptsBlock();
    } catch (error) {
      this.log(`Error setting up proxy traffic handlers: ${error}`);
      throw error;
    }
  }

  private async handleCaptchaBlockedRoutes() {
    this.captchaResponseHandler = async (response: Response) => {
      try {
        if (!captchaRequestRe.test(response.url())) return;

        await this.solveCaptcha();
      } catch (error) {
        this.log(`error while handling captcha blocked route: ${error}`);
      }
    };

    this.ctx.on("response", this.captchaResponseHandler);
  }

  // Abort on collector scripts, we don't want them to succeed
  private async handleCollectorScriptsBlock() {
    await this.page.route(collectorScriptUrlRe, async (route) => {
      try {
        this.log("Blocked collector script.");
        await route.abort();
      } catch (error) {
        this.log(`Error blocking collector script: ${error}`);
      }
    });
  }

  private handleCleanup() {
    this.withBaseCleanup(async () => {
      if (this.initGenerationInterval)
        clearInterval(this.initGenerationInterval);

      if (this.captchaResponseHandler)
        this.ctx.off("response", this.captchaResponseHandler);
    });
  }
}
