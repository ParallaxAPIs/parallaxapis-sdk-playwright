# 🚀 Parallax Playwright SDK: Datadome & Perimeterx

Easily interact with Datadome and Perimeterx anti-bot solutions using a simple Playwright SDK. Fast integration, clear API! ✨

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

---

## 📚 Documentation & Help

- Full API docs: [GitHub](https://github.com/parallaxsystems/parallax-sdk-playwright)
- Issues & support: [GitHub Issues](https://github.com/parallaxsystems/parallax-sdk-playwright/issues)

---

## 📝 License

MIT

---

Made with ❤️ by Parallax Systems