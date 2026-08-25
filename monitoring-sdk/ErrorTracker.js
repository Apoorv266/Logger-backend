import { addEvent } from "./EventQueue"

export function startErrorTracker() {
    window.addEventListener("error", event => {
        addEvent({
            id: crypto.randomUUID(),
            type: "javascript-error",
            message: event.message,
            file: event.error?.stack?.split("\n")[1]?.trim() || event.filename,
            stack: event.error?.stack,
            timestamp: new Date().toISOString(),
        })
    })
}

export function startPromiseTracker() {
    window.addEventListener("unhandledrejection", event => {
        addEvent({
            id: crypto.randomUUID(),
            type: "promise-error",
            message: event.reason?.message || String(event.reason),
            stack: event.reason?.stack,
            timestamp: new Date().toISOString(),
        })
    })
}

function captureExternalErrorBoundary(error, errorInfo, additionalParams = {}) {
    addEvent({
        id: crypto.randomUUID(),
        type: "javascript-error",
        message: error.toString(),
        file: error?.stack?.split("\n")[1]?.trim() || errorInfo?.componentStack?.split("\n")[1]?.trim(),
        stack: error?.stack,
        timestamp: new Date().toISOString(),
        ...additionalParams,
    })
}

if (typeof window !== "undefined" && typeof window.__captureErrorBoundaryEvent !== "function") {
    window.__captureErrorBoundaryEvent = () => {}
}

export function startErrorBoundaryTracker() {
    if (window.__errorBoundaryTrackerInitialized) {
        return
    }

    Object.defineProperty(window, "__captureErrorBoundaryEvent", {
        value: captureExternalErrorBoundary,
        writable: false,
        configurable: false,
    })

    window.__errorBoundaryTrackerInitialized = true
}

