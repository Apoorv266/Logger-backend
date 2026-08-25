import pool from "../config/db.js";

function validateApp(app) {
  if (typeof app !== "string" || app.trim() === "") {
    throw new TypeError("app must be a non-empty string");
  }

  return app.trim();
}

function validateOptionalFilter(value, name) {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }

  return value.trim();
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

function mapExpandedEvents(rows) {
  return rows.map(({ event, app, client_details: clientDetails }) => ({
    ...event,
    app,
    clientDetails,
  }));
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

export const getLogsByFilters = async ({ app, type, cmId } = {}) => {
  const validatedApp = validateApp(app);
  const validatedType = validateOptionalFilter(type, "type");
  const validatedCmId = validateOptionalFilter(cmId, "cmId");
  const values = [validatedApp];
  const conditions = ["log.app = $1"];

  if (validatedType !== null) {
    const parameterPosition = values.push(validatedType);
    conditions.push(
      `log.events @> JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('type', $${parameterPosition}::text))`,
      `expanded.event->>'type' = $${parameterPosition}`,
    );
  }

  if (validatedCmId !== null) {
    const parameterPosition = values.push(validatedCmId);
    conditions.push(
      `log.client_details->>'cmId' = $${parameterPosition}`,
    );
  }

  const result = await pool.query(
    `SELECT expanded.event, log.app, log.client_details
     FROM public.logs AS log
     CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS(log.events)
       WITH ORDINALITY AS expanded(event, event_order)
     WHERE ${conditions.join("\n       AND ")}
     ORDER BY log.created_at DESC, log.id DESC, expanded.event_order ASC`,
    values,
  );

  return mapExpandedEvents(result.rows);
};
