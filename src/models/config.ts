import type { ProxyAddress } from "parallax-sdk-ts";

export type Config = {
    apiKey: string,
    apiHost?: string,
    proxy: ProxyAddress,
    proxyRegion: string,
    region: string,
    site: string
};