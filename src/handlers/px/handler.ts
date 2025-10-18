import { chromium, type Browser, type BrowserContext, type Page, type Response } from "playwright";
import { PerimeterxSDK } from "parallax-sdk-ts";
import type { GeneratePxCookiesResponse } from "parallax-sdk-ts";
import type { Config } from "../../models/config";
import type { BrowserInitConfig } from "../datadome/handler";
import { SDKHelper } from "../sdk-helper/helper";

const collectorScriptUrlRe = /(?:http|https):\/\/(?=.*px)(?=.*collector).*/gmi;
const initGenerationInterval = 1000 * 60 * 4;

export class PerimeterxHandler extends SDKHelper {
    private sdk: PerimeterxSDK;
    private cfg: Config;
    private pxData: GeneratePxCookiesResponse = {} as GeneratePxCookiesResponse;
    private ctx: BrowserContext;
    private fallbackOrigin: string;

    private constructor(config: Config, ctx: BrowserContext, page: Page, sdk: PerimeterxSDK, fallbackOrigin: string) {
        super(
            "ParallaxAPIs PerimeterX Handler",
            page,
        );

        this.ctx = ctx;
        this.page = page;
        this.cfg = config;
        this.sdk = sdk;
        this.fallbackOrigin = fallbackOrigin;
    }

    public static async init(config: Config & { websiteUrl: string }, browserInitConfig?: BrowserInitConfig): Promise<[Page, Browser, BrowserContext, PerimeterxHandler]> {
        const proxyUrl = new URL(config.proxy);

        const sdk = new PerimeterxSDK({
            apiKey: config.apiKey,
            apiHost: config.apiHost
        });

        const browser = await chromium.launch({
            proxy: {
                server: `${proxyUrl.hostname}:${proxyUrl.port}`,
                password: proxyUrl.password,
                username: proxyUrl.username
            },
            headless: false,
            channel: 'chrome',
            ...browserInitConfig?.browserLaunchOptions,
        });

        const context = await browser.newContext({
            ...browserInitConfig?.contextLaunchOptions,
        });

        const page = await context.newPage();
        const handler = new PerimeterxHandler(config, context, page, sdk, new URL(config.websiteUrl).origin);

        await handler.proxyTraffic();

        return [page, browser, context, handler]
    }

    private async solveCaptcha() {
        this.log("Solving captcha...");

        const result = await this.sdk.generateHoldCaptcha({
            proxy: this.cfg.proxy,
            proxyregion: this.cfg.proxyRegion,
            region: this.cfg.region,
            site: this.cfg.site,
            data: this.pxData.data
        });

        const [cookieName, cookieValue] = result.cookie.split("=");

        if (!cookieName || !cookieValue) throw new Error("Api responded with malformed cookie");

        await this.ctx.clearCookies({ name: cookieName });
        await this.ctx.addCookies([{
            "name": cookieName,
            "value": cookieValue,
            "url": await this.getOrigin(),
        }]);

        this.log("Captcha solved!")

        return result;
    }

    private async solveInit() {
        this.log("Solving init...")

        const result = await this.sdk.generateCookies({
            proxy: this.cfg.proxy,
            proxyregion: this.cfg.proxyRegion,
            region: this.cfg.region,
            site: this.cfg.site
        });

        const [cookieName, cookieValue] = result.cookie.split("=");

        if (!cookieName || !cookieValue) throw new Error("Api responded with malformed cookie");

        let origin = await this.getOrigin();
        if (origin.length === 0) origin = this.fallbackOrigin;

        await this.ctx.clearCookies({ name: cookieName });
        await this.ctx.addCookies([{
            "name": cookieName,
            "value": cookieValue,
            "url": origin,
        }]);

        this.log("Init solved...")

        return result;
    }

    private async startInitGenerationInterval() {
        this.pxData = await this.solveInit();

        this.page.once("load", async () => {
            setInterval(async () => {
                try {
                    this.pxData = await this.solveInit();
                } catch (error) {
                    this.log("Error while generating inti cookie:", error)
                }
            }, initGenerationInterval);
        });
    }

    public async proxyTraffic() {
        await this.startInitGenerationInterval();

        this.handleCaptchaBlockedRoutes();
        this.startInitGenerationInterval();
        this.handleCollectorScriptsBlock();
    }

    private async handleCaptchaBlockedRoutes() {
        this.ctx.on("response", async (response: Response) => {
            if (response.status() == 403 && (await response.body()).toString().includes("pxCaptchaSrc")) {
                await this.solveCaptcha();
                await this.page.reload();
            }
        })
    }

    // Abort on collector scripts, we don't want them to succeed
    private async handleCollectorScriptsBlock() {
        await this.page.route(collectorScriptUrlRe, async (route) => {
            this.log("Blocked collector script.")
            await route.abort();
        });
    }
}