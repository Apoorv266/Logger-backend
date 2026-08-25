import {
  addLogs as addLogsModel,
  getAllLogs,
  getLogsByFilters,
} from "../models/useModel.js";

const flatEvents = (logs) => {
  return logs.flatMap((log) =>
    log.events.map((event) => ({
      ...event,
      app: log.app,
      clientDetails: log.client_details,
    })),
  );
};

export const handleResponse = (res, status, message, data = null) => {
  return res.status(status).json({
    status,
    message,
    data,
  });
};

export const fetchLogs = async (_req, res, next) => {
  try {
    const logs = await getAllLogs();
    const flatLogs = flatEvents(logs);
    return handleResponse(res, 200, "Logs fetched successfully", flatLogs);
  } catch (error) {
    return next(error);
  }
};

export const addLogs = async (req, res, next) => {
  try {
    console.log("Received payload:", JSON.stringify(req.body, null, 2));

    const log = await addLogsModel(req.body);
    return handleResponse(res, 201, "Logs added successfully", log);
  } catch (error) {
    return next(error);
  }
};

export const fetchLogsByFilters = async (req, res, next) => {
  try {
    const events = await getLogsByFilters(req.query);

    if (events.length === 0) {
      return handleResponse(
        res,
        404,
        "No events found for the supplied filters",
        [],
      );
    }

    return handleResponse(res, 200, "Events fetched successfully", events);
  } catch (error) {
    return next(error);
  }
};
