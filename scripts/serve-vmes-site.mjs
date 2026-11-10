import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultSiteRoot = path.resolve(scriptDirectory, "..", "dist", "vmes-site");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".wav", "audio/wav"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
  [".xpi", "application/x-xpinstall"]
]);

function isWithinRoot(root, filePath) {
  const relativePath = path.relative(root, filePath);
  return relativePath === ""
    || (relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath));
}

export function createVmesSiteServer(siteRoot = defaultSiteRoot) {
  const root = path.resolve(siteRoot);

  return http.createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    try {
      const requestUrl = new URL(request.url ?? "/", "http://localhost");
      const pathname = decodeURIComponent(requestUrl.pathname);
      const realRoot = await fs.realpath(root);
      let filePath = path.resolve(realRoot, `.${pathname}`);

      if (!isWithinRoot(realRoot, filePath)) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      filePath = await fs.realpath(filePath);
      if (!isWithinRoot(realRoot, filePath)) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      if ((await fs.stat(filePath)).isDirectory()) {
        filePath = await fs.realpath(path.join(filePath, "index.html"));
        if (!isWithinRoot(realRoot, filePath)) {
          response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          response.end("Not found");
          return;
        }
      }

      const file = await fs.readFile(filePath);
      response.writeHead(200, {
        "Content-Length": file.length,
        "Content-Type": contentTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff"
      });
      response.end(request.method === "HEAD" ? undefined : file);
    } catch (error) {
      if (error instanceof URIError) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Bad request");
        return;
      }
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR" || error?.code === "EACCES") {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      console.error("Could not serve Vmes site request:", error);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Internal server error");
    }
  });
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid Vmes site port: ${process.env.PORT}`);
  }

  const server = createVmesSiteServer();
  server.once("error", error => {
    console.error(`Could not start the Vmes site server on 127.0.0.1:${port}:`, error);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Vmes site available at http://127.0.0.1:${port}/`);
  });
}
