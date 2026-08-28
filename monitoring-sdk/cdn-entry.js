// monitoring/cdn-entry.js
// Bundled standalone via `npm run build:monitoring` and hosted on a CDN.
// Consuming pages include it as:
// <script src="https://logger.example.com/monitoring/v1/monitoring.min.js" data-app="nui"></script>

import { MonitoringService, normalizeEndpoint } from "./MonitoringService"

const PUBLIC_API_NAME = "kapture-monitoring"
const PUBLIC_API_VERSION = 1
const EMPTY_CONFIG = Object.freeze({})

function getOwnDataProperty(object, propertyName) {
    const descriptor = Object.getOwnPropertyDescriptor(object, propertyName)

    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value") ? descriptor.value : undefined
}

function normalizeString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function readClientConfig() {
    try {
        const windowConfigDescriptor = Object.getOwnPropertyDescriptor(window, "KaptureMonitoringConfig")

        if (!windowConfigDescriptor || !Object.prototype.hasOwnProperty.call(windowConfigDescriptor, "value")) {
            return EMPTY_CONFIG
        }

        const candidate = windowConfigDescriptor.value

        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
            return EMPTY_CONFIG
        }

        const prototype = Object.getPrototypeOf(candidate)

        if (prototype !== Object.prototype && prototype !== null) {
            return EMPTY_CONFIG
        }

        const endpoint = normalizeEndpoint(getOwnDataProperty(candidate, "endpoint"))
        const app = normalizeString(getOwnDataProperty(candidate, "app"))
        const getClientDetails = getOwnDataProperty(candidate, "getClientDetails")

        return Object.freeze({
            endpoint,
            app,
            getClientDetails: typeof getClientDetails === "function" ? getClientDetails : undefined,
        })
    } catch (_error) {
        return EMPTY_CONFIG
    }
}

function getDefaultEndpoint(script) {
    const scriptUrl = normalizeEndpoint(script?.src)

    return scriptUrl ? new URL("/api/logs", scriptUrl).href : undefined
}

function exposePublicApi() {
    const existingApi = getOwnDataProperty(window, "KaptureMonitoring")

    if (
        existingApi
        && getOwnDataProperty(existingApi, "name") === PUBLIC_API_NAME
        && getOwnDataProperty(existingApi, "version") === PUBLIC_API_VERSION
        && typeof getOwnDataProperty(existingApi, "setClientDetailsProvider") === "function"
    ) {
        return
    }

    const publicApi = Object.freeze({
        name: PUBLIC_API_NAME,
        version: PUBLIC_API_VERSION,
        setClientDetailsProvider: provider => MonitoringService.setClientDetailsProvider(provider),
    })

    try {
        Object.defineProperty(window, "KaptureMonitoring", {
            value: publicApi,
            writable: false,
            configurable: false,
        })
    } catch (_error) {
        // Keep monitoring active even when another non-configurable global uses this name.
    }
}

const script = document.currentScript
const clientConfig = readClientConfig()
exposePublicApi()

MonitoringService.start({
    endpoint: normalizeEndpoint(script?.dataset.endpoint) || clientConfig.endpoint || getDefaultEndpoint(script),
    app: normalizeString(script?.dataset.app) || clientConfig.app,
    getClientDetails: clientConfig.getClientDetails,
})
