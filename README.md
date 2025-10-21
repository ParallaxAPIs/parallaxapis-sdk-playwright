# 🚀 Parallax Playwright SDK: Datadome & Perimeterx

**Browser-based Playwright integration for bypassing DataDome and PerimeterX anti-bot protection.**

Perfect for developers who prefer browser automation over request-based approaches. This SDK seamlessly integrates with Playwright, automatically handling cookie generation and injection while you focus on your automation logic.

## ✨ Why Choose the Playwright SDK?

- **🎭 Native Playwright Integration**: Works directly with your existing Playwright workflows
- **🔄 Automatic Cookie Handling**: Transparent cookie generation and injection - set it and forget it
- **🖥️ Full Browser Context**: Real browser environment for sites requiring complex JavaScript execution
- **⚡ Zero Configuration**: Simple `.init()` method handles all setup automatically
- **🎯 Flexible Options**: Supports custom browser launch options, contexts, and proxy configurations
- **🛠️ Production-Ready**: Battle-tested with complex SPAs and JavaScript-heavy websites

---

## 📦 Installation

```bash
npm install parallax-sdk-playwright
```

---

## 🧑‍💻 PX Usage

### ⚡ SDK Initialization, and usage

Init methods in sdk will create a browser, and plug solvers for you. You can just create them with our SDK and you are ready to go!

```javascript
import { PerimeterxHandler } from 'parallax-sdk-playwright';

async function main() {
    const [page, browser] = await PerimeterxHandler.init({
        apiKey: "PX-KEY",
        apiHost: "parallaxhost.com",
        proxy: `http://user:password@host:port`,
        proxyRegion: "eu",
        region: "com",
        site: "website",
        websiteUrl: "https://www.website.com/"
    })

    await page.goto('https://www.website.com/');
    
    ...
    
        You can use your browser solution however you want, parallax 
        will handle everything for you. 
        
    ...
    
    await browser.close();
}

main().catch(console.error);

```

## Custom browser, or context options

You can also provide any browser, and context options which you need

```javascript
import { PerimeterxHandler } from 'parallax-sdk-playwright';

async function main() {
    const [page, browser] = await PerimeterxHandler.init({
        apiKey: "PX-KEY",
        apiHost: "parallaxhost.com",
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
    
    ...
    
        You can use your browser solution however you want, parallax 
        will handle everything for you. 
        
    ...
    
    await browser.close();
}

main().catch(console.error);

```

## ⚙️ SDK Configuration Options

You can configure SDK-level settings using the `sdkConfig` option in the initialization config. This allows you to customize request timeouts and use custom dispatchers.

```javascript
import { PerimeterxHandler } from 'parallax-sdk-playwright';
import { ProxyAgent } from 'undici';

async function main() {
    const [page, browser] = await PerimeterxHandler.init({
        apiKey: "PX-KEY",
        apiHost: "parallaxhost.com",
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
import DatadomeHandler from 'parallax-sdk-playwright';

async function main() {
    const [page, browser] = await DatadomeHandler.init({
        apiKey: "DD-KEY",
        apiHost: "parallaxhost.com",
        proxy: `http://user:password@host:port`,
        proxyRegion: "eu",
        region: "com",
        site: "website",
    })

    await page.goto('https://www.website.com/');
    
    ...
    
        You can use your browser solution however you want, parallax 
        will handle everything for you. 
        
    ...
    
    await browser.close();
}

main().catch(console.error);

```
You can also provide any browser, and context options which you need

```javascript
import DatadomeHandler from 'parallax-sdk-playwright';

async function main() {
    const [page, browser] = await DatadomeHandler.init({
        apiKey: "DD-KEY",
        apiHost: "parallaxhost.com",
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
    
    ...
    
        You can use your browser solution however you want, parallax 
        will handle everything for you. 
        
    ...
    
    await browser.close();
}

main().catch(console.error);

```

## Datadome with SDK Configuration

```javascript
import DatadomeHandler from 'parallax-sdk-playwright';
import { Agent } from 'undici';

async function main() {
    const [page, browser] = await DatadomeHandler.init({
        apiKey: "DD-KEY",
        apiHost: "parallaxhost.com",
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

- Full API docs: [GitHub](https://github.com/parallaxsystems/parallax-sdk-playwright)
- Issues & support: [GitHub Issues](https://github.com/parallaxsystems/parallax-sdk-playwright/issues)

---

## 🏢 Enterprise

Unlock enterprise-grade performance with custom solutions, expanded limits, and expert support. Contact us to learn more.

---

## 📝 License

MIT

---

## 🔑 Keywords

**DataDome bypass** • **PerimeterX bypass** • **Anti-bot bypass** • **Bot detection bypass** • **CAPTCHA solver** • **Playwright anti-bot** • **Browser automation** • **Playwright web scraping** • **DataDome Playwright SDK** • **PerimeterX Playwright SDK** • **Automated browser bypass** • **Playwright CAPTCHA solver** • **Browser fingerprinting bypass** • **Headless browser anti-bot** • **Playwright automation** • **Challenge solver Playwright** • **Browser-based bypass** • **Playwright bot detection**