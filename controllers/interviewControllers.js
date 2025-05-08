import { getGrpcClient } from "../utils/getGrpcClient.js";

// 📅 Schedule interview (InterviewService)
export const scheduleInterviews = async (req, res) => {
  console.log("[client:interview] 🟡 Starting to schedule interviews...");

  const client = await getGrpcClient(
    "InterviewService",
    "interview.proto",
    "interview",
    "InterviewService"
  );
  if (!client) {
    console.error("[client:interview] ❌ InterviewService unavailable");
    return res.status(500).json({ message: "InterviewService unavailable" });
  }

  const { date } = req.body;

  console.log("[client:interview] 🟡 Received scheduling data:", {
    date,
  });

  if (!date) {
    console.error("[client:interview] ❌ Invalid input data for scheduling");
    return res.status(400).json({ message: "Invalid input" });
  }

  client.ScheduleInterviews({ date }, (err, response) => {
    if (err) {
      console.error(
        "[client:interview] ❌ gRPC ScheduleInterviews error:",
        err
      );
      return res.status(500).json({ message: "Failed to schedule interviews" });
    }

    console.log(
      "[client:interview] 🟢 Interviews scheduled successfully:",
      response.scheduled
    );
    return res.json({
      message: response.message,
      scheduled: response.scheduled,
    });
  });
};

// ✏️ Edit interview
export const updateInterview = async (req, res) => {
  console.log("[client:interview] 🟡 Updating interview...");

  try {
    const client = await getGrpcClient(
      "InterviewService",
      "interview.proto",
      "interview",
      "InterviewService"
    );

    if (!client) {
      console.error("[client:interview] ❌ InterviewService unavailable");
      return res.status(500).json({ message: "InterviewService unavailable" });
    }

    const { id } = req.params;
    const { new_date, new_time } = req.body;

    if (!new_date || !new_time) {
      return res.status(400).json({ message: "Missing date or time" });
    }

    const payload = { id, new_date, new_time };
    console.log("[client:interview] 🟡 Payload:", payload);

    client.UpdateInterview(payload, (err, response) => {
      if (err) {
        console.error(
          "[client:interview] ❌ gRPC UpdateInterview error:",
          err.message
        );
        return res.status(500).json({ message: "Failed to update interview" });
      }

      if (!response || !response.updated) {
        return res.status(502).json({ message: "No interview data returned" });
      }

      console.log("[client:interview] 🟢 Interview updated:", response.updated);
      return res.status(200).json({
        message: response.message,
        interview: response.updated,
      });
    });
  } catch (err) {
    console.error("[client:interview] ❌ Unexpected error:", err.message);
    res.status(500).json({ message: "Unexpected server error" });
  }
};

// 🗑️ Delete interview
export const deleteInterview = async (req, res) => {
  console.log("[client:interview] 🟡 Deleting interview...");

  try {
    const client = await getGrpcClient(
      "InterviewService",
      "interview.proto",
      "interview",
      "InterviewService"
    );

    if (!client) {
      console.error("[client:interview] ❌ InterviewService unavailable");
      return res.status(500).json({ message: "InterviewService unavailable" });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Interview ID is required" });
    }

    client.DeleteInterview({ id }, (err, response) => {
      if (err) {
        console.error("[client:interview] ❌ gRPC DeleteInterview error:", err);
        return res.status(500).json({ message: "Failed to delete interview" });
      }

      if (!response || !response.id) {
        return res
          .status(404)
          .json({ message: "Interview not found or not deleted" });
      }
      console.log("[client:interview] 🟢 Interview deleted:", response);
      console.log("[client:interview] 🟢 Interview deleted:", response.id);
      return res.status(200).json({
        message: response.message,
        id: response.id,
      });
    });
  } catch (err) {
    console.error("[client:interview] ❌ Unexpected error:", err);
    res.status(500).json({ message: "Unexpected server error" });
  }
};
