import { Browser, BrowserContext, Page } from "playwright"

export type HandlerInitValues<SDKType, HandlerType> = {
    page: Page,
    browser: Browser,
    browserContext: BrowserContext,
    handler: HandlerType,
    sdk: SDKType
}