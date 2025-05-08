import { getGrpcClientForService } from "../utils/getGrpcClientForService.js";

// 📅 Schedule interview (InterviewService)
export const scheduleInterviews = async (req, res) => {
  console.log("[client:interview] 🟡 Starting to schedule interviews...");

  const client = await getGrpcClientForService("InterviewService");

  const { date } = req.body;

  console.log("[client:interview] 🟡 Received scheduling data:", { date });

  if (!date) {
    return res.status(400).json({ message: "Date is required for scheduling" });
  }

  const response = await new Promise((resolve, reject) => {
    client.ScheduleInterviews({ date }, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });

  if (!response || !response.scheduled) {
    const error = new Error("Failed to schedule interviews");
    error.statusCode = 502;
    throw error;
  }

  console.log(
    "[client:interview] 🟢 Interviews scheduled successfully:",
    response.scheduled
  );

  return res.status(200).json({
    message: response.message,
    scheduled: response.scheduled,
  });
};

// ✏️ Update interview (InterviewService)
export const updateInterview = async (req, res) => {
  console.log("[client:interview] 🟡 Updating interview...");
  const client = await getGrpcClientForService("InterviewService");

  const { id } = req.params;
  const { new_date, new_time } = req.body;

  if (!new_date || !new_time) {
    return res.status(400).json({ message: "New date and time are required" });
  }

  const payload = { id, new_date, new_time };
  console.log("[client:interview] 🟡 Payload:", payload);

  const response = await new Promise((resolve, reject) => {
    client.UpdateInterview(payload, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });

  if (!response || !response.updated) {
    const error = new Error("No interview data returned from service");
    error.statusCode = 502;
    throw error;
  }

  console.log("[client:interview] 🟢 Interview updated:", response.updated);

  return res.status(200).json({
    message: response.message,
    interview: response.updated,
  });
};

// 🗑️ Delete interview (InterviewService)
export const deleteInterview = async (req, res) => {
  console.log("[client:interview] 🟡 Deleting interview...");

  const client = await getGrpcClientForService("InterviewService");

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Interview ID is required" });
  }

  const response = await new Promise((resolve, reject) => {
    client.DeleteInterview({ id }, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });

  if (!response || !response.id) {
    return res
      .status(404)
      .json({ message: "Interview not found or not deleted" });
  }

  console.log("[client:interview] 🟢 Interview deleted:", response);

  return res.status(200).json({
    message: response.message,
    id: response.id,
  });
};
