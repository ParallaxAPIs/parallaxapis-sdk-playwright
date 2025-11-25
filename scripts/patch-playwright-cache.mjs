import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const candidates = [
  path.resolve(__dirname, "..", "node_modules", "playwright-core", "lib", "server", "chromium", "crNetworkManager.js"),
  path.resolve(__dirname, "..", "..", "playwright-core", "lib", "server", "chromium", "crNetworkManager.js"),
  path.resolve(process.cwd(), "node_modules", "playwright-core", "lib", "server", "chromium", "crNetworkManager.js")
]

console.log(candidates)

let target = null

for (const p of candidates) {
  if (fs.existsSync(p)) {
    target = p
    break
  }
}

if (!target) {
  process.exit(0)
}

const src = fs.readFileSync(target, "utf8")
let out = src

out = out.replaceAll("cacheDisabled: true", "cacheDisabled: false")
out = out.replaceAll("cacheDisabled: enabled", "cacheDisabled: false")

out = out.replace(
  /Network\.setCacheDisabled'\s*,\s*\{[^}]*cacheDisabled\s*:\s*[^,}]+[^}]*\}/g,
  m => m.replace(/cacheDisabled\s*:\s*[^,}]+/g, "cacheDisabled: false")
)

out = out.replace(
  /Network\.setCacheDisabled\(\s*\{[^}]*cacheDisabled\s*:\s*[^,}]+[^}]*\}\s*\)/g,
  m => m.replace(/cacheDisabled\s*:\s*[^,}]+/g, "cacheDisabled: false")
)

if (out !== src) {
  fs.writeFileSync(target, out, "utf8")
  console.log("[patch-playwright-cache] patched", target)
} else {
  console.log("[patch-playwright-cache] nothing to patch (pattern not found)")
}
