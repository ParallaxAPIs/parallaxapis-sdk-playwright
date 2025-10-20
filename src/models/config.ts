import type { ProxyAddress } from "parallax-sdk-ts";
import type { Dispatcher } from "undici";

export type Config = {
    apiKey: string,
    apiHost?: string,
    proxy: ProxyAddress,
    proxyRegion: string,
    region: string,
    site: string

    sdkConfig: {
        timeout?: number
        bodyTimeout?: number
        dispatcher?: Dispatcher
    }
};