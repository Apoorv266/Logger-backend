import "dotenv/config";
import pool from "./config/db.js";
import createLogsTable from "./data/createUserTable.js";
import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 3001;

const startServer = async () => {
  try {
    await createLogsTable();
    const app = createApp();

    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to initialize the database", error);
    process.exitCode = 1;
    await pool.end();
  }
};

startServer();
