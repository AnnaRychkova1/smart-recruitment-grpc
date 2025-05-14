import { Metadata } from "@grpc/grpc-js";
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

  const metadata = new Metadata();
  metadata.add("authorization", `${req.headers.authorization}`);

  const response = await new Promise((resolve, reject) => {
    client.ScheduleInterviews({ date }, metadata, (err, response) => {
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

  const metadata = new Metadata();
  metadata.add("authorization", `${req.headers.authorization}`);
  const response = await new Promise((resolve, reject) => {
    client.UpdateInterview(payload, metadata, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });

  if (!response) {
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

  const metadata = new Metadata();
  metadata.add("authorization", `${req.headers.authorization}`);

  const response = await new Promise((resolve, reject) => {
    client.DeleteInterview({ id }, metadata, (err, response) => {
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

export const rescheduleInterviews = async (req, res) => {
  console.log("[client:interview] 🟡 Starting to reschedule interviews...");

  const client = await getGrpcClientForService("InterviewService");
  const { interviews } = req.body;

  if (!Array.isArray(interviews) || interviews.length === 0) {
    return res
      .status(400)
      .json({ message: "No interviews provided to reschedule." });
  }

  console.log(
    "[client:interview] 🟡 Received interviews to reschedule:",
    interviews
  );

  const metadata = new Metadata();
  metadata.add("authorization", `${req.headers.authorization}`);

  try {
    const response = await new Promise((resolve, reject) => {
      const stream = client.StreamAndReschedule(metadata);

      const receivedResponses = [];

      stream.on("data", (data) => {
        console.log("[client:interview] 🟢 Server response received:", data);
        receivedResponses.push(data);
      });

      stream.on("end", () => {
        console.log(
          `[client:interview] ✅ Stream ended. All interview are rescheduled.`
        );
        resolve({
          message: `Rescheduling completed for ${receivedResponses.length} candidates`,
          scheduled: receivedResponses,
        });
      });

      stream.on("error", (err) => {
        console.error("[client:interview] ❌ Stream error:", err);
        reject(err);
      });

      for (const interview of interviews) {
        console.log("[client:interview] 📤 Sending interview:", interview);
        stream.write(interview);
      }

      stream.end();
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error(
      "[client:interview] ❌ Failed to reschedule interviews:",
      error
    );
    return res.status(500).json({
      message: "Failed to reschedule interviews",
      error: error.message,
    });
  }
};
