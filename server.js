const http = require("http");
const { readFile } = require("fs/promises");
const { extname, join, normalize } = require("path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 8081);
const ROOT = join(__dirname, "public");
const SEVENTEEN_LANDS_ORIGIN = "https://www.17lands.com";
const ALLOWED_PROXY_PATHS = new Set([
  "/card_ratings/data",
  "/color_ratings/data",
  "/data/filters",
]);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, headers);
  response.end(body);
}

function sendJson(response, statusCode, value) {
  send(response, statusCode, JSON.stringify(value), {
    "content-type": "application/json; charset=utf-8",
  });
}

async function proxy17Lands(request, response, url) {
  const upstreamPath = url.pathname.replace(/^\/api\/17lands/, "") || "/";
  if (!ALLOWED_PROXY_PATHS.has(upstreamPath)) {
    sendJson(response, 404, { error: "Unsupported 17Lands endpoint" });
    return;
  }

  const upstream = new URL(upstreamPath, SEVENTEEN_LANDS_ORIGIN);
  upstream.search = url.search;

  try {
    const upstreamResponse = await fetch(upstream, {
      headers: {
        accept: "application/json",
        "user-agent": "Rank My Draft local tool",
      },
    });
    const body = await upstreamResponse.text();
    send(response, upstreamResponse.status, body, {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    });
  } catch (error) {
    sendJson(response, 502, {
      error: "Could not fetch 17Lands data",
      detail: error.message,
    });
  }
}

async function serveStatic(response, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    send(response, 403, "Forbidden", { "content-type": "text/plain" });
    return;
  }

  try {
    const body = await readFile(filePath);
    send(response, 200, body, {
      "cache-control": "no-store",
      "content-type":
        CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
    });
  } catch (error) {
    send(response, 404, "Not found", { "content-type": "text/plain" });
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname.startsWith("/api/17lands/")) {
    await proxy17Lands(request, response, url);
    return;
  }
  await serveStatic(response, url);
});

server.listen(PORT, HOST, () => {
  console.log(`Rank My Draft running at http://${HOST}:${PORT}/`);
});
