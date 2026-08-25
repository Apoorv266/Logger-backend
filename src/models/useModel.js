import pool from "../config/db.js";

function validateApp(app) {
  if (typeof app !== "string" || app.trim() === "") {
    throw new TypeError("app must be a non-empty string");
  }

  return app.trim();
}

function validateType(type) {
  if (typeof type !== "string" || type.trim() === "") {
    throw new TypeError("type must be a non-empty string");
  }

  return type.trim();
}

function validateClientDetails(clientDetails) {
  if (clientDetails === undefined) {
    return null;
  }

  if (
    clientDetails === null ||
    typeof clientDetails !== "object" ||
    Array.isArray(clientDetails)
  ) {
    throw new TypeError("clientDetails must be a JSON object");
  }

  return clientDetails;
}

export const getAllLogs = async () => {
  const result = await pool.query("SELECT * FROM logs");
  return result.rows;
};

export const addLogs = async ({ app, events, clientDetails } = {}) => {
  const validatedApp = validateApp(app);
  const validatedClientDetails = validateClientDetails(clientDetails);

  if (!Array.isArray(events)) {
    throw new TypeError("events must be an array");
  }

  const result = await pool.query(
    `INSERT INTO logs (app, events, client_details)
     VALUES ($1, $2::jsonb, $3::jsonb)
     RETURNING id, app, events, client_details AS "clientDetails", created_at`,
    [
      validatedApp,
      JSON.stringify(events),
      validatedClientDetails === null
        ? null
        : JSON.stringify(validatedClientDetails),
    ],
  );

  return result.rows[0];
};

export const getLogsByApp = async (app) => {
  const validatedApp = validateApp(app);
  const result = await pool.query("SELECT * FROM logs WHERE app = $1", [validatedApp]);

  return result.rows;
};

export const getLogsByAppAndType = async (app, type) => {
  const validatedApp = validateApp(app);
  const validatedType = validateType(type);
  const result = await pool.query(
    `SELECT expanded.event, log.client_details
     FROM public.logs AS log
     CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(log.events)
       WITH ORDINALITY AS expanded(event, event_order)
     WHERE log.app = $1
       AND log.events @> JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('type', $2::text))
       AND expanded.event->>'type' = $2
     ORDER BY log.created_at DESC, log.id DESC, expanded.event_order ASC`,
    [validatedApp, validatedType],
  );

  return result.rows.map(({ event, client_details: clientDetails }) => ({
    ...event,
    clientDetails,
  }));
};
