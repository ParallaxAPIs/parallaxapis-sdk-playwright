import { Mutex } from "async-mutex";
import fs from "fs";
import { DatadomeSDK } from "parallax-sdk-ts";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type LaunchOptions, type Page, type Request, type Response } from 'playwright';
import type { Config } from "../../models/config";
import { SDKHelper } from "../sdk-helper/helper";

const DATADOME_COOKIE_LENGTH = 128;

export type BrowserInitConfig = {
    browserLaunchOptions?: Omit<LaunchOptions, 'proxy' | 'headless' | 'channel'>
    contextLaunchOptions?: Omit<BrowserContextOptions, 'userAgent'>
}

export default class DatadomeHandler extends SDKHelper {
    private ctx: BrowserContext;
    private sdk: DatadomeSDK;
    private cfg: Config;
    private blockedRequest: Request | undefined
    private tagsProcessing: boolean = false;
    private mu: Mutex = new Mutex();

    private constructor(config: Config, ctx: BrowserContext, page: Page, sdk: DatadomeSDK) {
        super(
            "ParallaxAPIs Datadome Handler",
            page,
        );

        this.ctx = ctx;
        this.page = page;
        this.cfg = config;
        this.sdk = sdk;
    }

    // Init function, it handles everything for a user, you can customize a browser launch options, and browser context launch options 
    public static async init(config: Config, browserInitConfig?: BrowserInitConfig): Promise<[Page, Browser, BrowserContext, DatadomeHandler]> {
        const proxyUrl = new URL(config.proxy);

        const sdk = new DatadomeSDK({
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

        const ua = await sdk.generateUserAgent({ region: "eu", site: config.site });

        const context = await browser.newContext({
            userAgent: ua.UserAgent,
            ...browserInitConfig?.contextLaunchOptions,
        });

        const page = await context.newPage();
        const handler = new DatadomeHandler(config, context, page, sdk);

        await handler.proxyTraffic();

        return [page, browser, context, handler]
    }

    // Handles datadome block, like captcha or intersitial. 
    // after solving, sdk retries blocked request and refreshes a page. 
    private async handleBlock(url: string) {
        try {
            this.log("Got blocked, solving datadome...");

            const cookies = await this.ctx.cookies();
            const datadomeCookie = cookies.find((cookie) => cookie.name == "datadome");

            if (!datadomeCookie) throw Error("couldn't find initial datadome cookie");

            const [task, pd] = this.sdk.parseChallengeUrl(url, datadomeCookie.value);

            const solveResult = await this.sdk.generateCookie({
                data: task,
                pd: pd,
                proxy: this.cfg.proxy,
                proxyregion: this.cfg.proxyRegion,
                region: this.cfg.region,
                site: this.cfg.site
            });

            if (solveResult.error) throw new Error(solveResult.message ? solveResult.message : solveResult.cookie);
            if (!solveResult.message) throw new Error("api didn't return any cookie");

            const [cookieName, cookieValue] = solveResult.message.split("=");

            if (!cookieName || !cookieValue) throw new Error("api returned malformed cookie");

            this.log("Got blocked, solving datadome...");



            await this.ctx.clearCookies({ name: "datadome" });
            await this.ctx.addCookies([{
                "name": cookieName,
                "value": cookieValue,
                "url": await this.getOrigin(),
            }]);
        } catch (error) {
            this.log(`Error while handling block: ${error}`);
        }
    }

    public async proxyTraffic() {
        this.replaceTagsCookie();
        this.handleCaptchaRequest();
        this.handleBlockedRoutes();
    }

    // Saves blocked requests, so we can retry them later
    private async handleBlockedRoutes() {
        this.ctx.on("response", async (response: Response) => {
            if (response.status() == 403 && JSON.stringify(await response.json()).includes("captcha-delivery")) {
                this.blockedRequest = response.request();
            }
        })
    }

    // Blocks a geo captcha page request, for better flow, solves a challange, and retries blocked request.
    private async handleCaptchaRequest() {
        await this.page.route(/geo\.captcha\-delivery\.com\/(interstitial|captcha)/gm, async (route) => {
            const request = route.request();

            const blockHandlingPromise = this.handleBlock(request.url());

            await route.fulfill({
                body: fs.readFileSync("./assets/solving.html", "utf-8")
            });

            await blockHandlingPromise;

            if (this.blockedRequest != undefined) {
                await this.page.evaluate(async ({ method, headers, postData, url }) => {
                    if (url) return await fetch(url, { method: method, body: postData, headers: headers }).then(res => res.status);
                }, {
                    method: this.blockedRequest.method(),
                    headers: this.blockedRequest.headers(),
                    postData: this.blockedRequest.postData(),
                    url: this.blockedRequest.url(),
                });

                this.blockedRequest = undefined;
            }

            await this.page.reload();
        });
    }

    // Blocks datadome collector script, and replaces response body with cookie from an api.
    private async replaceTagsCookie(): Promise<void> {
        await this.page.route('**/js', async (route) => {
            try {
                const request = route.request();
                const postData = request.postData();

                const release = await this.mu.acquire();

                try {
                    if (this.tagsProcessing || !postData || request.method() !== 'POST' || !postData.includes('ddk')) {
                        return await route.continue();
                    };

                    this.tagsProcessing = true;
                } finally {
                    release();
                }

                const response = await this.page.evaluate(async ({ url, options }) => {
                    try {
                        const response = await fetch(url, {
                            method: options.method,
                            headers: options.headers,
                            body: options.body
                        });

                        const body = await response.json();

                        return {
                            success: true,
                            status: response.status,
                            headers: Object.fromEntries(response.headers.entries()),
                            body: body
                        };
                    } catch {
                        return { success: false };
                    }
                }, {
                    url: request.url(), options: {
                        method: request.method(),
                        headers: request.headers(),
                        body: request.postData()
                    }
                });

                if (!response.success) return route.abort();

                const bodyJson = response.body as { cookie: string };

                const solveResult = await this.sdk.generateDatadomeTagsCookie({
                    site: this.cfg.site,
                    region: this.cfg.region,
                    proxyregion: this.cfg.proxyRegion,
                    proxy: this.cfg.proxy,
                    data: { cid: "null" },
                });

                // We get response like this, from here we want to get a cookie template, so we don't need to set domain and other stuff 
                // manually, .slice just strips response so we can put our own cookie in this template.
                // {"cookie":"datadome=<Cookie with 128 length>; Max-Age=31536000; Domain=.origin.com; Path=/; Secure; SameSite=Lax"}
                const template = bodyJson.cookie.slice("datadome=".length + DATADOME_COOKIE_LENGTH);
                const bodyCookie = `${solveResult.message}${template}`;

                this.log("Solved tags payload.")

                await route.fulfill({
                    status: response.status,
                    headers: response.headers,
                    body: JSON.stringify({
                        "status": response.status,
                        "cookie": bodyCookie
                    })
                });
            } catch {
                await route.continue();
            }
        });
    }
}