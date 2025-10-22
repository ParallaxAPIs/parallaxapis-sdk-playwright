import { defineConfig } from "tsup";
import fs from "fs";
import path from "path";

const replaceSolvingHtmlPaths = () => {
  const dist = "./dist/";

  const paths = fs.readdirSync(path.join(dist));

  for (const filePath of paths) {
    const fullFilePath = path.join(dist, filePath);
    const assetFileRe = /(\/|.\/|)assets\/([^"'`]+)/gim;

    const contents = fs.readFileSync(fullFilePath, "utf-8");
    const fixedContents = contents.replaceAll(assetFileRe, "$2");

    fs.writeFileSync(fullFilePath, fixedContents, "utf-8");
  }
};

export default defineConfig({
  format: ["cjs", "esm"],
  entry: ["./src/index.ts"],
  dts: true,
  shims: true,
  skipNodeModulesBundle: true,
  clean: true,
  sourcemap: true,
  publicDir: "./assets",
  onSuccess: async () => {
    replaceSolvingHtmlPaths();
  },
});
