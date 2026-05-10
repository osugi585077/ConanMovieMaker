import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const distDir = join(root, "dist");
const siteDir = join(root, "site");

let html = await readFile(join(distDir, "app.html"), "utf8");

const scriptMatch = html.match(/<script type="module" crossorigin src="(.+?)"><\/script>/);
const cssMatch = html.match(/<link rel="stylesheet" crossorigin href="(.+?)">/);

if (!scriptMatch || !cssMatch) {
  throw new Error("Could not find built JS/CSS references in dist/app.html");
}

const scriptPath = scriptMatch[1].replace(/^\.\//, "");
const cssPath = cssMatch[1].replace(/^\.\//, "");
const script = (await readFile(join(distDir, scriptPath), "utf8")).replace(/<\/script/gi, "<\\/script");
const css = (await readFile(join(distDir, cssPath), "utf8")).replace(/<\/style/gi, "<\\/style");

html = html
  .replace(cssMatch[0], () => `<style>\n${css}\n</style>`)
  .replace(scriptMatch[0], () => `<script type="module">\n${script}\n</script>`);

await mkdir(siteDir, { recursive: true });
await writeFile(join(siteDir, "index.html"), html);
await copyFile(join(distDir, "original-aoyama.png"), join(siteDir, "original-aoyama.png"));
await copyFile(join(distDir, "example.png"), join(siteDir, "example.png"));

await writeFile(join(root, "index.html"), html);
await copyFile(join(siteDir, "original-aoyama.png"), join(root, "original-aoyama.png"));
await copyFile(join(siteDir, "example.png"), join(root, "example.png"));
