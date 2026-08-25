import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import { createApp, getAllowedOrigins } from "../src/app.js";

let baseUrl;
let server;

before(async () => {
  const app = createApp({
    allowedOrigins: [
      "http://localhost:3000",
      "https://crm.example.com",
    ],
  });

  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", (error) =>
      error ? reject(error) : resolve(),
    );
    server.once("error", reject);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server?.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("parses the plural origin allowlist and supports the legacy variable", () => {
  assert.deepEqual(
    getAllowedOrigins({
      FRONTEND_ORIGINS:
        "http://localhost:3000, https://crm.example.com,  ",
    }),
    ["http://localhost:3000", "https://crm.example.com"],
  );
  assert.deepEqual(
    getAllowedOrigins({ FRONTEND_ORIGIN: "https://legacy.example.com" }),
    ["https://legacy.example.com"],
  );
});

test("serves the monitoring bundle publicly with safe revalidation headers", async () => {
  const response = await fetch(`${baseUrl}/monitoring/monitoring.min.js`, {
    headers: { Origin: "https://unlisted.example.com" },
  });
  const bundle = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /javascript/);
  assert.equal(
    response.headers.get("cache-control"),
    "public, max-age=0, must-revalidate",
  );
  assert.equal(
    response.headers.get("cross-origin-resource-policy"),
    "cross-origin",
  );
  assert.ok(response.headers.get("etag"));
  assert.ok(bundle.length > 1_000);
});

test("revalidates the stable monitoring bundle URL with its ETag", async () => {
  const firstResponse = await fetch(
    `${baseUrl}/monitoring/monitoring.min.js`,
  );
  const etag = firstResponse.headers.get("etag");
  const secondStatus = await new Promise((resolve, reject) => {
    const request = http.get(
      `${baseUrl}/monitoring/monitoring.min.js`,
      { headers: { "If-None-Match": etag } },
      (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode));
      },
    );
    request.once("error", reject);
  });

  assert.equal(secondStatus, 304);
});

for (const origin of [
  "http://localhost:3000",
  "https://crm.example.com",
]) {
  test(`allows API requests from ${origin}`, async () => {
    const response = await fetch(`${baseUrl}/api/logs`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
  });
}

test("rejects API requests from an origin outside the allowlist", async () => {
  const response = await fetch(`${baseUrl}/api/logs`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://unlisted.example.com",
      "Access-Control-Request-Method": "POST",
    },
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.message, "Origin is not allowed");
});

test("continues to support origin-less API clients", async () => {
  const response = await fetch(`${baseUrl}/api/logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app: "kapturecrm-ui" }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.message, "events must be an array");
});
