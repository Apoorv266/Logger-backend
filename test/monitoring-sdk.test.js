import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";

const bundlePath = path.resolve("public/monitoring/monitoring.min.js");

function createBrowserContext() {
  const intervals = [];
  const listeners = new Map();
  const requests = [];
  let nextId = 0;

  const browser = {
    ArrayBuffer,
    Blob,
    CustomEvent: class CustomEvent {
      constructor(type) {
        this.type = type;
      }
    },
    FormData,
    Headers,
    Request,
    URL,
    URLSearchParams,
    Uint8Array,
    console: {
      log() {},
      info() {},
      warn() {},
      error() {},
      debug() {},
      table() {},
      group() {},
      groupEnd() {},
    },
    crypto: {
      randomUUID() {
        nextId += 1;
        return `event-${nextId}`;
      },
    },
    document: {
      currentScript: {
        dataset: {
          endpoint: "https://logger.example.com/api/logs",
          app: "kapturecrm-ui",
        },
      },
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true };
    },
    location: { href: "https://crm.example.com/nui/" },
    performance: { now: () => 1 },
    setInterval(callback) {
      intervals.push(callback);
      return intervals.length;
    },
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || new Set();
      callbacks.add(callback);
      listeners.set(type, callbacks);
    },
    removeEventListener(type, callback) {
      listeners.get(type)?.delete(callback);
    },
    dispatchEvent(event) {
      listeners.get(event.type)?.forEach((callback) => callback(event));
    },
  };

  browser.window = browser;
  browser.globalThis = browser;

  return { browser, intervals, requests };
}

test("the browser SDK is idempotent and flushes events", async () => {
  const bundle = await readFile(bundlePath, "utf8");
  const { browser, intervals, requests } = createBrowserContext();
  const context = vm.createContext(browser);

  vm.runInContext(
    `window.KaptureMonitoringConfig = {
      getClientDetails: () => ({ userId: "123", tenantId: "acme" })
    }`,
    context,
  );
  vm.runInContext(bundle, context);

  const firstConsoleLog = browser.console.log;
  vm.runInContext(bundle, context);

  assert.equal(intervals.length, 1);
  assert.equal(browser.console.log, firstConsoleLog);
  assert.equal(browser.KaptureMonitoring, undefined);

  browser.console.log("Customer page loaded");
  intervals[0]();
  await Promise.resolve();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://logger.example.com/api/logs");

  const payload = JSON.parse(requests[0].options.body);
  assert.equal(payload.app, "kapturecrm-ui");
  assert.equal(payload.events.length, 1);
  assert.equal(payload.events[0].type, "console");
  assert.deepEqual(payload.clientDetails, {
    userId: "123",
    tenantId: "acme",
  });
});
