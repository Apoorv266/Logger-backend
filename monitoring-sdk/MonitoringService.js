// monitoring/MonitoringService.js

import { startConsoleTracker } from "./ConsoleTracker";
import {
  startErrorBoundaryTracker,
  startErrorTracker,
  startPromiseTracker,
} from "./ErrorTracker";
import { getQueue } from "./EventQueue";
import { startFetchTracker } from "./FetchTracker";
import { OriginalConsole } from "./OriginalConsole";

let clientDetailsProvider;

export function normalizeEndpoint(value) {
  const endpoint =
    typeof value === "string" && value.trim() ? value.trim() : undefined;

  if (!endpoint) {
    return undefined;
  }

  try {
    const url = new URL(endpoint, window.location.href);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : undefined;
  } catch (error) {
    return undefined;
  }
}

function getCurrentCmId() {
  if (typeof clientDetailsProvider !== "function") {
    return undefined;
  }

  try {
    const cmId = clientDetailsProvider()?.cmId;
    return cmId === undefined || cmId === null ? undefined : String(cmId).trim();
  } catch (error) {
    return undefined;
  }
}

function getFreshClientDetails() {
  if (typeof clientDetailsProvider !== "function") {
    return {};
  }

  try {
    const clientDetails = clientDetailsProvider();

    if (
      !clientDetails ||
      typeof clientDetails !== "object" ||
      Array.isArray(clientDetails)
    ) {
      OriginalConsole.warn(
        "MonitoringService: client details provider must return an object",
      );
      return {};
    }

    const normalizedClientDetails = JSON.parse(JSON.stringify(clientDetails));

    if (
      !normalizedClientDetails ||
      typeof normalizedClientDetails !== "object" ||
      Array.isArray(normalizedClientDetails)
    ) {
      OriginalConsole.warn(
        "MonitoringService: client details provider must return a JSON object",
      );
      return {};
    }

    return normalizedClientDetails;
  } catch (error) {
    OriginalConsole.error(
      "MonitoringService: failed to get client details",
      error,
    );
    return {};
  }
}

export const MonitoringService = {
  // if SDK loads first , this sets clientDetailsProvider
  setClientDetailsProvider(provider) {
    if (typeof provider !== "function") {
      OriginalConsole.warn(
        "MonitoringService: setClientDetailsProvider expects a function",
      );
      return false;
    }

    clientDetailsProvider = provider;
    return true;
  },

  start(config = {}) {
    if (window.__kaptureMonitoringStarted) {
      return false;
    }

    const endpoint = normalizeEndpoint(config.endpoint);

    // if react loads first , this sets clientDetailsProvider
    if (typeof config.getClientDetails === "function") {
      clientDetailsProvider = config.getClientDetails;
    }

    startConsoleTracker(getCurrentCmId);
    startErrorTracker();
    startPromiseTracker();
    startFetchTracker({
      getCurrentCmId,
      ignoredUrls: [endpoint],
    });
    startErrorBoundaryTracker();

    window.__kaptureMonitoringStarted = true;

    setInterval(() => {
      const events = getQueue();

      if (events.length === 0) {
        return;
      }

      if (!endpoint) {
        OriginalConsole.table(events);
        return;
      }

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: config.app,
          events,
          clientDetails: getFreshClientDetails(),
        }),
      }).catch((error) =>
        OriginalConsole.error(
          "MonitoringService: failed to report events",
          error,
        ),
      );
    }, 20000);

    return true;
  },
};
