// monitoring/MonitoringService.js

import { startConsoleTracker } from "./ConsoleTracker"
import { startErrorBoundaryTracker, startErrorTracker, startPromiseTracker } from "./ErrorTracker"
import { getQueue } from "./EventQueue"
import { startFetchTracker } from "./FetchTracker"
import { OriginalConsole } from "./OriginalConsole"

function getClientDetails(getClientDetailsCallback) {
    if (typeof getClientDetailsCallback !== "function") {
        return {}
    }

    try {
        const clientDetails = getClientDetailsCallback()

        if (clientDetails && typeof clientDetails === "object" && !Array.isArray(clientDetails)) {
            return clientDetails
        }

        OriginalConsole.warn("MonitoringService: getClientDetails must return an object")
    } catch (error) {
        OriginalConsole.error("MonitoringService: failed to get client details", error)
    }

    return {}
}

export const MonitoringService = {
    start(config = {}) {
        if (window.__kaptureMonitoringStarted) {
            return false
        }

        startConsoleTracker()
        startErrorTracker()
        startPromiseTracker()
        startFetchTracker({
            ignoredUrls: [
                config.endpoint,
                "https://firebaselogging-pa.googleapis.com",
                "https://www.google-analytics.com", 
                "https://analytics.google.com", 
                "https://api.eu.amplitude.com"
            ],
        })
        startErrorBoundaryTracker()

        window.__kaptureMonitoringStarted = true

        setInterval(() => {
            const events = getQueue()

            if (events.length === 0) {
                return
            }

            if (!config.endpoint) {
                OriginalConsole.table(events)
                return
            }

            fetch(config.endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    app: config.app,
                    events,
                    clientDetails: getClientDetails(config.getClientDetails),
                }),
            }).catch(error => OriginalConsole.error("MonitoringService: failed to report events", error))
        }, 20000)

        return true
    },
}
