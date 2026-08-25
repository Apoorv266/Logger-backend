import express from "express";
import {
  addLogs,
  fetchLogs,
  fetchLogsByApp,
  fetchLogsByAppAndType,
} from "../controller/userController.js";

const router = express.Router();

router.post("/logs", addLogs);
router.get(["/logs", "/fetch-logs"], fetchLogs);
router.get("/logs/filter", fetchLogsByAppAndType);
router.get("/logs/:app", fetchLogsByApp);

export default router;
