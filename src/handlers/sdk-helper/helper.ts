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
    const u = new URL(await this.page.url());
    return u.origin === 'null' ? '' : u.origin;
    }
}