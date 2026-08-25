# Logger service backend

This service stores frontend monitoring events and hosts the browser monitoring
SDK used to collect them.

## Run locally

```bash
npm run dev
```

The API listens on `http://localhost:3001` by default. The example environment
uses port `5001`. Configure the port, database, and allowed frontend origins with
the environment variables documented in `.env.example`.

`FRONTEND_ORIGINS` is a comma-separated allowlist. For example, local development
and a deployed CRM can be enabled together with
`FRONTEND_ORIGINS=http://localhost:3000,https://crm.example.com`.
`FRONTEND_ORIGIN` remains supported as a fallback for older deployments.

## Load the monitoring SDK

The standalone SDK is publicly available at:

```text
http://localhost:5001/monitoring/monitoring.min.js
```

Set `window.KaptureMonitoringConfig` before loading the script. The configuration
supports:

- `endpoint`: the complete log-ingestion URL, such as
  `http://localhost:5001/api/logs`.
- `app`: the application name stored with each event.
- `getClientDetails`: an optional callback that returns current user, tenant, or
  browser context. It is called at flush time, so late-arriving login state is
  supported.

Alternatively, `data-endpoint` and `data-app` attributes can be placed on the
script element. These attributes take precedence over the global configuration.
The script loads as a classic IIFE and starts automatically.

The SDK file is intentionally public. Browser log submission is restricted by
the API origin allowlist; CORS is not authentication and does not prevent direct
non-browser requests.

If the consuming application uses Content Security Policy, its `script-src` must
allow this backend to load the SDK and its `connect-src` must allow the SDK to
post events.

## Update the monitoring SDK

The editable source is in `monitoring-sdk/`. Never edit the minified file
directly. After changing the source, regenerate and verify the committed bundle:

```bash
npm run build:monitoring
npm run check:monitoring
```

The test command also verifies that the committed bundle matches its source.

## Submit frontend logs

Send a log envelope to `POST /api/logs`:

```js
const response = await fetch("http://localhost:3001/api/logs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    app: "kapturecrm-ui",
    events: [
      { level: "info", message: "Page loaded" },
      { level: "error", message: "Request failed", status: 500 },
    ],
    clientDetails: {
      browser: "Chrome",
      os: "macOS",
      version: "140.0",
    },
  }),
});

if (!response.ok) {
  throw new Error(`Logging failed with status ${response.status}`);
}
```

`clientDetails` is optional for backward compatibility. When supplied, it must be
a JSON object; values such as `null`, arrays, strings, numbers, and booleans are
rejected with status `400`.

Successful requests store the event batch and client metadata in PostgreSQL and
return the created row:

```json
{
  "status": 201,
  "message": "Logs added successfully",
  "data": {
    "id": "1",
    "app": "kapturecrm-ui",
    "events": [
      { "level": "info", "message": "Page loaded" },
      { "level": "error", "message": "Request failed", "status": 500 }
    ],
    "clientDetails": {
      "browser": "Chrome",
      "os": "macOS",
      "version": "140.0"
    },
    "created_at": "2026-08-24T00:00:00.000Z"
  }
}
```

The submitted data is also printed to the server console. The application does
not impose a request-body or array-length limit.

## Filter events by app and type

```http
GET /api/logs/filter?app=kapturecrm-ui&type=console
```

The `data` array contains only the matching event objects:

```json
{
  "status": 200,
  "message": "Events fetched successfully",
  "data": [
    {
      "type": "console",
      "message": "Page loaded",
      "clientDetails": {
        "browser": "Chrome",
        "os": "macOS",
        "version": "140.0"
      }
    }
  ]
}
```

The general `GET /api/logs` and app-specific `GET /api/logs/:app` endpoints also
copy the batch-level `clientDetails` object onto every returned event. Events
stored before this column was added return `"clientDetails": null`.
