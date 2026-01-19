import type { Browser, BrowserContext, Page } from "patchright";

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

  protected async getHostname(): Promise<string> {
    const u = new URL(this.page.url());
    return u.hostname;
  }

  protected async getDomain(origin: string): Promise<string> {
    const url = new URL(origin);

    const sliceAmt = url.hostname.includes("co.uk") ? -3 : -2;

    const domain = url.hostname.split(".").length > 2
      ? (
          url.hostname
            .split(".")
            .slice(sliceAmt)
            .join(".")
      )
      : url.hostname;
      
    return domain;
  }

  protected async replaceCookie(
    cookieName: string,
    value: string,
    origin: string,
  ) {
    const domain = await this.getDomain(origin);

    // Clear cookies only for this specific domain
    await this.ctx.clearCookies({
      name: cookieName,
      domain: `.${domain}`,
    });

    await this.addCookie(cookieName, value, domain);
  }

  protected async addCookie(
    cookieName: string,
    value: string,
    domain: string,
  ) {
    // Set expiry to 24 hours from now
    const expiryDate = Math.floor(Date.now() / 1000) + (60 * 60 * 24); // Unix timestamp in seconds

    await this.ctx.addCookies([
      {
        name: cookieName,
        value: value,
        domain: `.${domain}`,
        path: '/',
        expires: expiryDate, // prevents losing cookie ctx on domain change;
        secure: true,
        sameSite: 'Lax',
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
