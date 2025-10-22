import type { Browser, BrowserContext, Page } from "playwright";

export class SDKHelper {
  private disableLogging?: boolean;
  private logPrefix: string;
  protected page: Page;
  protected browser: Browser;
  protected ctx: BrowserContext;
  private cleanupExecuted: boolean = false;

  constructor(
    logPrefix: string,
    page: Page,
    browser: Browser,
    ctx: BrowserContext,
    disableLogging: boolean,
  ) {
    this.logPrefix = logPrefix;
    this.page = page;
    this.browser = browser;
    this.ctx = ctx;
    this.disableLogging = disableLogging;
  }

  protected log(text: string) {
    if (this.disableLogging) return;

    console.log(`[${this.logPrefix}] ${text}`);
  }

  protected async getOrigin(): Promise<string> {
    const u = new URL(this.page.url());
    return u.origin === "null" ? "" : u.origin;
  }

  protected async replaceCookie(
    cookieName: string,
    value: string,
    origin: string,
  ) {
    await this.ctx.clearCookies({ name: cookieName });
    await this.ctx.addCookies([
      {
        name: cookieName,
        value: value,
        url: origin,
      },
    ]);
  }

  protected withBaseCleanup(
    ...additionalCleanupFunctions: (() => Promise<void>)[]
  ) {
    const cleanup = async (source: string) => {
      if (this.cleanupExecuted) return;
      this.cleanupExecuted = true;

      try {
        this.log(`Cleaning up [reason: ${source}]...`);

        if (additionalCleanupFunctions.length > 0) {
          for (const f of additionalCleanupFunctions) {
            await f();
          }
        }

        this.page.removeAllListeners();
        this.ctx.removeAllListeners();
      } finally {
        this.log(`Cleaned up [reason: ${source}]`);
      }
    };

    this.page.once("close", () => {
      cleanup("page close");
    });

    this.ctx.once("close", () => {
      cleanup("context close");
    });

    this.browser.once("disconnected", () => {
      cleanup("browser disconnected");
    });
  }
}
