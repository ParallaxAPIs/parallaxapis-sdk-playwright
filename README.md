# 🚀 ParallaxAPIs Playwright SDK: Datadome & Perimeterx

**Playwright SDK for bypassing DataDome and PerimeterX anti-bot protection.**

## 📖 About Parallax API

ParallaxAPIs provides a **request-based solution** for bypassing DataDome and PerimeterX anti-bot systems. Instead of relying on slow, resource-heavy browser automation, our API generates valid cookies and tokens in **200-400ms** through direct HTTP requests.

**What We Solve:**
- ✅ **DataDome** - Slider captchas, interstitial pages, cookie generation, tags payload
- ✅ **PerimeterX** - Cookie generation (_px3), challenge solver, vid & cts tokens

**Key Benefits:**
- ⚡ **Lightning Fast** - 200-400ms response times vs 2-5+ seconds for browsers
- 🔧 **Simple Integration** - Clean API, no browser management required
- 🚀 **Highly Scalable** - Handle thousands of concurrent requests with minimal resources
- 💰 **Cost Effective** - Lightweight infrastructure, minimal proxy usage
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

![NPM Install Playwright Demo](npminstallplaywright.gif)

---

## 🧑‍💻 PX Usage

### ⚡ SDK Initialization, and usage

Init methods in sdk will create a browser, and plug solvers for you. You can just create them with our SDK and you are ready to go!

```javascript
import { PerimeterxHandler } from 'parallaxapis-sdk-playwright';

async function main() {
    const [page, browser] = await PerimeterxHandler.init({
        apiKey: "PX-KEY",
        apiHost: "parallaxhost.com", //optional
        proxy: `http://user:password@host:port`,
        proxyRegion: "eu",
        region: "com",
        site: "website",
        websiteUrl: "https://www.website.com/"
    })

    await page.goto('https://www.website.com/');
    
    /*
    
        You can use your browser solution however you want, ParallaxAPIs 
        will handle the rest for you. 
        
    */
    
    await browser.close();
}

main().catch(console.error);

```

## Custom browser, or context options

You can also provide any browser, and context options which you need

```javascript
import { PerimeterxHandler } from 'parallaxapis-sdk-playwright';

async function main() {
    const [page, browser] = await PerimeterxHandler.init({
        apiKey: "PX-KEY",
        apiHost: "parallaxhost.com", //optional
        proxy: `http://user:password@host:port`,
        proxyRegion: "eu",
        region: "com",
        site: "website",
        websiteUrl: "https://www.website.com/"
    }, {
        browserLaunchOptions: {
            executablePath: "/home/user/chrome/executable"
            // ...... More options  
        },
        contextLaunchOptions: {
            isMobile: true
            // ...... More options 
        }
    })

    await page.goto('https://www.website.com/');
    
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
    const [page, browser] = await PerimeterxHandler.init({
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
            dispatcher: new ProxyAgent('http://custom-proxy:8080') // Custom proxy dispatcher (optional)
        }
    })

    await page.goto('https://www.website.com/');

    ...

    await browser.close();
}

main().catch(console.error);

```

### Configuration Options

- **timeout** (optional): Maximum time in milliseconds for the entire request to complete
- **bodyTimeout** (optional): Maximum time in milliseconds to wait for the response body
- **dispatcher** (optional): Custom undici `Dispatcher` instance for advanced HTTP client configurations (connection pooling, pipelining, etc.)

## 🧑‍💻 Datadome Usage

## Pretty much the same for datadome

```javascript
import DatadomeHandler from 'parallaxapis-sdk-playwright';

async function main() {
    const [page, browser] = await DatadomeHandler.init({
        apiKey: "DD-KEY",
        apiHost: "parallaxhost.com", //optional
        proxy: `http://user:password@host:port`,
        proxyRegion: "eu",
        region: "com",
        site: "website",
    })

    await page.goto('https://www.website.com/');
    
    /*
    
        You can use your browser solution however you want, ParallaxAPIs 
        will handle the rest for you. 
        
    */
    
    await browser.close();
}

main().catch(console.error);

```
You can also provide any browser, and context options which you need

```javascript
import DatadomeHandler from 'parallaxapis-sdk-playwright';

async function main() {
    const [page, browser] = await DatadomeHandler.init({
        apiKey: "DD-KEY",
        apiHost: "parallaxhost.com", //optional
        proxy: `http://user:password@host:port`,
        proxyRegion: "eu",
        region: "com",
        site: "website",
    }, {
        browserLaunchOptions: {
            executablePath: "/home/user/chrome/executable"
            // ...... More options  
        },
        contextLaunchOptions: {
            isMobile: true
            // ...... More options 
        }
    })

    await page.goto('https://www.website.com/');
    
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
import DatadomeHandler from 'parallaxapis-sdk-playwright';
import { Agent } from 'undici';

async function main() {
    const [page, browser] = await DatadomeHandler.init({
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
