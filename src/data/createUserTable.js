import pool from "../config/db.js";

const createLogsTable = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.logs (
        id BIGSERIAL PRIMARY KEY,
        app TEXT NOT NULL,
        events JSONB NOT NULL,
        client_details JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT logs_app_not_blank CHECK (BTRIM(app) <> ''),
        CONSTRAINT logs_events_is_array CHECK (JSONB_TYPEOF(events) = 'array'),
        CONSTRAINT logs_client_details_is_object CHECK (
          client_details IS NULL OR JSONB_TYPEOF(client_details) = 'object'
        )
      )
    `);

    // CREATE TABLE IF NOT EXISTS does not modify tables that already exist.
    // This keeps existing installations in sync while preserving old rows as NULL.
    await client.query(`
      ALTER TABLE public.logs
      ADD COLUMN IF NOT EXISTS client_details JSONB
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'public.logs'::regclass
            AND conname = 'logs_client_details_is_object'
        ) THEN
          ALTER TABLE public.logs
          ADD CONSTRAINT logs_client_details_is_object CHECK (
            client_details IS NULL OR JSONB_TYPEOF(client_details) = 'object'
          );
        END IF;
      END;
      $$
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS logs_app_idx
      ON public.logs (app)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS logs_events_gin_idx
      ON public.logs USING GIN (events JSONB_PATH_OPS)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS logs_app_cm_id_idx
      ON public.logs (app, (client_details->>'cmId'))
    `);

    await client.query("COMMIT");
    console.log("Logs table is ready");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export default createLogsTable;
