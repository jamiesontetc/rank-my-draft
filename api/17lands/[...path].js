const SEVENTEEN_LANDS_ORIGIN = "https://www.17lands.com";
const ALLOWED_PROXY_PATHS = new Set([
  "/card_ratings/data",
  "/color_ratings/data",
  "/data/filters",
]);

function requestedPath(pathSegments) {
  const segments = Array.isArray(pathSegments)
    ? pathSegments
    : [pathSegments].filter(Boolean);
  return `/${segments.join("/")}`;
}

function applyCommonHeaders(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET, HEAD, OPTIONS");
  response.setHeader("cache-control", "no-store");
}

function sendJson(response, statusCode, payload) {
  applyCommonHeaders(response);
  response.status(statusCode).json(payload);
}

module.exports = async function handler(request, response) {
  applyCommonHeaders(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (!["GET", "HEAD"].includes(request.method)) {
    response.setHeader("allow", "GET, HEAD, OPTIONS");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const upstreamPath = requestedPath(request.query.path);
  if (!ALLOWED_PROXY_PATHS.has(upstreamPath)) {
    sendJson(response, 404, { error: "Unsupported 17Lands endpoint" });
    return;
  }

  const upstream = new URL(upstreamPath, SEVENTEEN_LANDS_ORIGIN);
  for (const [key, rawValue] of Object.entries(request.query)) {
    if (key === "path") continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value !== undefined) upstream.searchParams.append(key, value);
    }
  }

  try {
    const upstreamResponse = await fetch(upstream, {
      headers: {
        accept: "application/json",
        "user-agent": "Rank My Draft Vercel proxy",
      },
    });
    const body = await upstreamResponse.text();

    response.status(upstreamResponse.status);
    response.setHeader(
      "content-type",
      upstreamResponse.headers.get("content-type") ||
        "application/json; charset=utf-8"
    );
    response.send(request.method === "HEAD" ? "" : body);
  } catch (error) {
    sendJson(response, 502, {
      error: "Could not fetch 17Lands data",
      detail: error.message,
    });
  }
};
