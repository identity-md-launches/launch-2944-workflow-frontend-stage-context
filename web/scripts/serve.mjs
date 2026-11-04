// Static subpath preview shared by Playwright and manual browser inspection.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist");
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const port = Number(process.argv[2] ?? 4185);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/" || url.pathname === "/preview") {
      res.writeHead(302, { location: "/preview/" });
      res.end();
      return;
    }
    if (!url.pathname.startsWith("/preview/")) throw new Error("Not found");
    let file = resolve(
      root,
      decodeURIComponent(url.pathname.slice("/preview/".length)) ||
        "index.html",
    );
    if (!file.startsWith(root + "/")) throw new Error("Not found");
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    const bytes = await readFile(file);
    res.writeHead(200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "0.0.0.0", () =>
  console.log(`Static export: http://127.0.0.1:${port}/preview/`),
);
