import fs from "fs"
import path from "path"

const target = path.join(process.cwd(), "node_modules", "playwright-core", "lib", "server", "chromium", "crNetworkManager.js")
if (!fs.existsSync(target)) process.exit(0)

const src = fs.readFileSync(target, "utf8")
let out = src
out = out.replaceAll("cacheDisabled: true", "cacheDisabled: false")
out = out.replaceAll("cacheDisabled: enabled", "cacheDisabled: false")

if (out !== src) fs.writeFileSync(target, out, "utf8")