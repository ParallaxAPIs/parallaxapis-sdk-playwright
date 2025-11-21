# <img src="https://github.com/ParallaxAPIs/.github/blob/main/profile/logo.png" alt="Parallax Logo" width="30" height="30" style="vertical-align: middle;"> ParallaxAPIs Playwright SDK: Datadome & PerimeterX

**Playwright SDK for bypassing DataDome and PerimeterX anti-bot protection.**

## 📖 Overview

ParallaxAPIs Playwright SDK provides **seamless browser automation without anti-bot barriers**. While browser automation is required, we handle all the complexity of bypassing DataDome and PerimeterX protection systems automatically, so you can focus on your automation logic.

**What We Solve:**

- ✅ **DataDome** - Slider captchas, interstitial pages, automatic cookie injection
- ✅ **PerimeterX** - Automatic cookie generation and injection (\_px3), challenge solving

**Key Benefits:**

- ⚡ **Seamless Integration** - Effortlessly plug in handlers that work out of the box with your existing Playwright setup
- 🌉 **Best of Both Worlds** - Bridge between browser automation and request-based anti-bot solutions
- 🔧 **Simple API** - Clean interface with comprehensive documentation
- 🌐 **Full Browser Context** - Real browser environment for JavaScript-heavy sites
- ⚙️ **Flexible Configuration** - Custom browser options, contexts, and proxy settings
- 🍪 **Automatic Cookie Handling** - Set it and forget it - we inject cookies seamlessly
- 🔄 **Always Updated** - We handle all reverse engineering and updates for you

---

## 🚀 Quick Start

Get started with ParallaxAPIs SDK's in under 5 minutes:

1. **Join our [Discord](https://www.parallaxsystems.io/join?s=gh)** - Connect with our community
2. **Create a ticket** - Request your API key
3. **Get your free trial** - Start testing immediately
4. **[Install the SDK](#-installation)** - Choose your preferred language
5. **Solve all anti-bots in seconds** - Start bypassing DataDome, PerimeterX & more

---

## 📦 Installation

```bash
npm install parallaxapis-sdk-playwright
```

![NPM Install Playwright Demo](https://github.com/ParallaxAPIs/.github/blob/main/profile/npminstallplaywright.gif)

---

## 🧑‍💻 PX Usage

### ⚡ SDK Initialization and usage

Initialization methods within the SDK will establish a browser environment and configure the necessary solvers. Once you've created these components with our SDK, you're fully prepared to proceed.

```javascript
import { PerimeterxHandler } from "parallaxapis-sdk-playwright";

async function main() {
  const { page, browser, handler, sdk, browserContext } = await PerimeterxHandler.init({
    apiKey: "PX-KEY",
    apiHost: "parallaxhost.com", //optional
    proxy: `http://user:password@host:port`,
    proxyRegion: "eu",
    region: "com",
    site: "website",
    websiteUrl: "https://www.website.com/",
    disableLogging: true, // Optional: disable SDK logging
  });

  await page.goto("https://www.website.com/");

  /*

        You can use your browser solution however you want, ParallaxAPIs
        will handle the rest for you.

    */

  await browser.close();
}

main().catch(console.error);
```

## Checking Usage

You can check your API usage using either the `handler` or `sdk` instance:

```javascript
import { PerimeterxHandler } from "parallaxapis-sdk-playwright";

async function main() {
  const { page, browser, handler, sdk } = await PerimeterxHandler.init({
    apiKey: "PX-KEY",
    apiHost: "parallaxhost.com", //optional
    proxy: `http://user:password@host:port`,
    proxyRegion: "eu",
    region: "com",
    site: "website",
    websiteUrl: "https://www.website.com/",
  });

  // Check usage via handler
  const usage = await handler.checkUsage();
  console.log("Current usage:", usage);

  // Or check usage via SDK directly
  const usageViaSdk = await sdk.checkUsage("website");
  console.log("Current usage:", usageViaSdk);

  await page.goto("https://www.website.com/");

  await browser.close();
}

main().catch(console.error);
```

## Custom browser or context options

Additionally, you have the flexibility to provide your own browser configuration and context options as needed.

```javascript
import { PerimeterxHandler } from "parallaxapis-sdk-playwright";

async function main() {
  const { page, browser, handler, sdk, browserContext } = await PerimeterxHandler.init(
    {
      apiKey: "PX-KEY",
      apiHost: "parallaxhost.com", //optional
      proxy: `http://user:password@host:port`,
      proxyRegion: "eu",
      region: "com",
      site: "website",
      websiteUrl: "https://www.website.com/",
    },
    {
      browserLaunchOptions: {
        executablePath: "/home/user/chrome/executable",
        // ...... More options
      },
      contextLaunchOptions: {
        isMobile: true,
        // ...... More options
      },
    },
  );

  await page.goto("https://www.website.com/");

  /*

        You can use your browser solution however you want, ParallaxAPIs
        will handle the rest for you.

    */

  await browser.close();
}

main().catch(console.error);
```

## ⚙️ SDK Configuration Options

You can configure SDK-level settings using the `sdkConfig` option in the initialization config. This allows you to customize request timeouts and use custom dispatchers.

```javascript
import { PerimeterxHandler } from 'parallaxapis-sdk-playwright';
import { ProxyAgent } from 'undici';

async function main() {
    const { page, browser, handler, sdk, browserContext } = await PerimeterxHandler.init({
        apiKey: "PX-KEY",
        apiHost: "parallaxhost.com", //optional
        proxy: `http://user:password@host:port`,
        proxyRegion: "eu",
        region: "com",
        site: "website",
        websiteUrl: "https://www.website.com/",
        sdkConfig: {
            timeout: 30000,        // Request timeout in milliseconds (optional)
            bodyTimeout: 10000,    // Body timeout in milliseconds (optional)
            dispatcher: new ProxyAgent("http://proxy:port", {
              requestTls: { rejectUnauthorized: false }
            }) // Custom undici dispatcher (optional)
        }
    })

    await page.goto('https://www.website.com/');

    ...

    await browser.close();
}

main().catch(console.error);

```

### Configuration Options

**Core Options:**

- **disableLogging** (optional): Set to `true` to disable SDK logging output (default: `false`)

**SDK Config Options:**

- **timeout** (optional): Maximum time in milliseconds for the entire request to complete
- **bodyTimeout** (optional): Maximum time in milliseconds to wait for the response body
- **dispatcher** (optional): Custom undici `Dispatcher` instance for advanced HTTP client configurations (connection pooling, pipelining, etc.)

## 🧑‍💻 Datadome Usage

```javascript
import { DatadomeHandler } from "parallaxapis-sdk-playwright";

async function main() {
  const { page, browser, handler, sdk, browserContext } = await DatadomeHandler.init({
    apiKey: "DD-KEY",
    apiHost: "parallaxhost.com", //optional
    proxy: `http://user:password@host:port`,
    proxyRegion: "eu",
    region: "com",
    site: "website",
    disableLogging: true, // Optional: disable SDK logging
  });

  await page.goto("https://www.website.com/");

  /*

        You can use your browser solution however you want, ParallaxAPIs
        will handle the rest for you.

    */

  await browser.close();
}

main().catch(console.error);
```

## Checking Usage

You can check your API usage using either the `handler` or `sdk` instance:

```javascript
import { DatadomeHandler } from "parallaxapis-sdk-playwright";

async function main() {
  const { page, browser, handler, sdk } = await DatadomeHandler.init({
    apiKey: "DD-KEY",
    apiHost: "parallaxhost.com", //optional
    proxy: `http://user:password@host:port`,
    proxyRegion: "eu",
    region: "com",
    site: "website",
  });

  // Check usage via handler
  const usage = await handler.checkUsage();
  console.log("Current usage:", usage);

  // Or check usage via SDK directly
  const usageViaSdk = await sdk.checkUsage("website");
  console.log("Current usage:", usageViaSdk);

  await page.goto("https://www.website.com/");

  await browser.close();
}

main().catch(console.error);
```

The system supports providing custom browser implementations and context options tailored to your requirements.

```javascript
import { DatadomeHandler } from "parallaxapis-sdk-playwright";

async function main() {
  const { page, browser, handler, sdk, browserContext } = await DatadomeHandler.init(
    {
      apiKey: "DD-KEY",
      apiHost: "parallaxhost.com", //optional
      proxy: `http://user:password@host:port`,
      proxyRegion: "eu",
      region: "com",
      site: "website",
    },
    {
      browserLaunchOptions: {
        executablePath: "/home/user/chrome/executable",
        // ...... More options
      },
      contextLaunchOptions: {
        isMobile: true,
        // ...... More options
      },
    },
  );

  await page.goto("https://www.website.com/");

  /*

        You can use your browser solution however you want, ParallaxAPIs
        will handle the rest for you.

    */

  await browser.close();
}

main().catch(console.error);
```

## Datadome with SDK Configuration

```javascript
import { DatadomeHandler } from 'parallaxapis-sdk-playwright';
import { Agent } from 'undici';

async function main() {
    const { page, browser, handler, sdk, browserContext } = await DatadomeHandler.init({
        apiKey: "DD-KEY",
        apiHost: "parallaxhost.com", //optional
        proxy: `http://user:password@host:port`,
        proxyRegion: "eu",
        region: "com",
        site: "website",
        sdkConfig: {
            timeout: 30000,        // Request timeout in milliseconds
            bodyTimeout: 10000,    // Body timeout in milliseconds
            dispatcher: new Agent({
                connections: 100,
                pipelining: 10
            })
        }
    }, {
        browserLaunchOptions: {
            executablePath: "/home/user/chrome/executable"
        },
        contextLaunchOptions: {
            isMobile: true
        }
    })

    await page.goto('https://www.website.com/');

    ...

    await browser.close();
}

main().catch(console.error);

```

---

## 📚 Documentation & Help

- Full API docs & support: [Discord](https://www.parallaxsystems.io/join?s=gh)

## 🌟 Contributing

Got feedback or found a bug? Feel free to open an issue or send us a pull request!

## 🏢 Enterprise

Unlock enterprise-grade performance with custom solutions, expanded limits, and expert support. [Contact us](https://www.parallaxsystems.io/join?s=gh) to learn more.

## 📝 License

MIT

---

## 🔑 Keywords

**DataDome bypass** • **PerimeterX bypass** • **Anti-bot bypass** • **Bot detection bypass** • **CAPTCHA solver** • **Playwright anti-bot** • **Browser automation** • **Playwright web scraping** • **DataDome Playwright SDK** • **PerimeterX Playwright SDK** • **Automated browser bypass** • **Playwright CAPTCHA solver** • **Browser fingerprinting bypass** • **Headless browser anti-bot** • **Playwright automation** • **Challenge solver Playwright** • **Browser-based bypass** • **Playwright bot detection**
