import type { Page } from "playwright";

export class SDKHelper {
    private logPrefix: string;
    protected page: Page;

    constructor(logPrefix: string, page: Page) {
        this.logPrefix = logPrefix
        this.page = page;
    }

    protected log(text: string) {
        console.log(`[${this.logPrefix}] ${text}`);
    }

    protected async getOrigin(): Promise<string> {
        // @ts-ignore
        const origin = await this.page.evaluate(() => window.origin);
        if (origin == "null") return "";
        return origin;
    }
}