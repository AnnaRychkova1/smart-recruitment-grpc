// app.js
import express from "express";
import path from "path";
import dotenv from "dotenv";
import multer from "multer";
import { getGrpcClient } from "../utils/getGrpcClient.js";

dotenv.config();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${file.fieldname}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({ storage });

const app = express();
app.use(express.json());

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "gui", "views"));
app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// 🔁 Add candidate (HiringService)
app.post("/add-candidate", upload.single("pathCV"), async (req, res) => {
  console.log("[client:hiring] 🟡 Starting to add a candidate...");

  try {
    const client = await getGrpcClient(
      "HiringService",
      "hiring.proto",
      "hiring",
      "HiringService"
    );
    if (!client) {
      console.error("[client:hiring] ❌ HiringService client is not available");
      return res.status(500).json({ message: "HiringService not available" });
    }

    const { name, email, position, experience } = req.body;
    const pathCV = req.file?.path || "";

    console.log("[client:hiring] 🟡 Received data to add candidate:", {
      name,
      email,
      position,
      experience: parseInt(experience),
      pathCV,
    });

    //  gRPC
    client.AddCandidate(
      {
        name,
        email,
        position,
        experience: parseInt(experience),
        pathCV,
      },
      (err, response) => {
        if (err) {
          console.error("[client:hiring] ❌ gRPC AddCandidate error:", err);
          return res.status(500).json({ message: "Failed to add candidate" });
        }
        if (!response || !response.candidate) {
          console.warn("[client:hiring] ⚠️ gRPC returned no candidate.");
          return res.status(502).json({
            message: "No candidate data received from service.",
          });
        }

        console.log(
          "[client:hiring] 🟢 Candidate added successfully:",
          response.candidate
        );
        return res.json({
          status: response.status,
          message: response.message,
          candidate: response.candidate,
        });
      }
    );
  } catch (err) {
    console.error("[client:hiring] ❌ Unexpected error:", err.message);
    return res.status(500).json({ message: "Unexpected server error" });
  }
});

// 📥 Get candidates (HiringService)
app.get("/get-candidates", async (req, res) => {
  console.log("[client:hiring] 🟡 Fetching all candidates...");

  try {
    const client = await getGrpcClient(
      "HiringService",
      "hiring.proto",
      "hiring",
      "HiringService"
    );

    if (!client) {
      console.error("[client:hiring] ❌ HiringService client unavailable");
      return res.status(500).json({ message: "HiringService not available" });
    }

    const call = client.GetAllCandidates({});
    const candidates = [];

    call.on("data", (candidate) => {
      candidates.push(candidate);
    });

    call.on("end", () => {
      console.log(
        "[client:hiring] ✅ Stream ended. Candidates received:",
        candidates.length
      );
      return res.status(200).json({
        message: candidates.length
          ? "Candidates fetched successfully."
          : "No candidates found.",
        candidates,
      });
    });

    call.on("error", (err) => {
      console.error("[client:hiring] ❌ Stream error:", err.message);
      return res.status(500).json({
        message: "Failed to get candidates from gRPC service.",
        error: err.message,
      });
    });
  } catch (err) {
    console.error("[client:hiring] ❌ Unexpected error:", err.message);
    return res.status(500).json({ message: "Unexpected server error" });
  }
});

// ✏️ Edit candidate
app.put("/update-candidate/:id", upload.single("pathCV"), async (req, res) => {
  console.log("[client:hiring] 🟡 Starting to edit a candidate...");

  try {
    const client = await getGrpcClient(
      "HiringService",
      "hiring.proto",
      "hiring",
      "HiringService"
    );

    if (!client) {
      console.error("[client:hiring] ❌ HiringService client is not available");
      return res.status(500).json({ message: "HiringService not available" });
    }

    const { name, email, position, experience, existingPathCV } = req.body;
    const pathCV = req.file?.path || existingPathCV || "";
    const _id = req.params.id;

    const payload = {
      _id,
      name,
      email,
      position,
      experience: parseInt(experience),
      pathCV,
    };

    console.log("[client:hiring] 🟡 Sending update payload:", payload);

    client.UpdateCandidate(payload, (err, response) => {
      if (err) {
        console.error(
          "[client:hiring] ❌ gRPC UpdateCandidate error:",
          err.message
        );
        return res.status(500).json({ message: "Failed to update candidate" });
      }

      if (!response) {
        console.warn(
          "[client:hiring] ⚠️ No response from gRPC UpdateCandidate."
        );
        return res
          .status(502)
          .json({ message: "No response from hiring service" });
      }

      console.log("[client:hiring] 🟢 UpdateCandidate response:", response);

      // Map gRPC status to HTTP status
      switch (response.status) {
        case 400:
          return res.status(400).json({ message: response.message });
        case 404:
          return res.status(404).json({ message: response.message });
        case 200:
          return res.status(200).json({
            message: response.message,
            candidate: response.candidate,
          });
        default:
          return res
            .status(500)
            .json({ message: "Unexpected response status" });
      }
    });
  } catch (err) {
    console.error("[client:hiring] ❌ Unexpected error:", err.message);
    return res.status(500).json({ message: "Unexpected server error" });
  }
});

// 🗑️ Delete candidate
app.delete("/delete-candidate/:id", async (req, res) => {
  console.log("[client:hiring] 🟡 Starting to delete candidate...");

  try {
    const client = await getGrpcClient(
      "HiringService",
      "hiring.proto",
      "hiring",
      "HiringService"
    );

    if (!client) {
      console.error("[client:hiring] ❌ HiringService client is not available");
      return res.status(500).json({ message: "HiringService not available" });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Candidate ID is required" });
    }

    console.log("[client:hiring] 🟡 Request to delete candidate with ID:", id);

    client.DeleteCandidate({ id }, (err, response) => {
      if (err) {
        console.error(
          "[client:hiring] ❌ gRPC DeleteCandidate error:",
          err.message
        );
      }

      console.log(
        "[client:hiring] 🟢 Candidate deleted successfully:",
        response
      );
      return res
        .status(200)
        .json({ message: response.message, id: response.id });
    });
  } catch (err) {
    console.error("[client:hiring] ❌ Unexpected error:", err);
    return res.status(500).json({ message: "Unexpected server error" });
  }
});

// 📤 Filtering (FilteringService)
app.get("/filter-candidates", async (req, res) => {
  console.log("[client:filtering] 🟡 Starting to filter candidates...");

  try {
    const client = await getGrpcClient(
      "FilteringService",
      "filtering.proto",
      "filtering",
      "FilteringService"
    );

    if (!client) {
      console.error(
        "[client:filtering] ❌ FilteringService client is not available"
      );
      return res
        .status(500)
        .json({ message: "FilteringService not available" });
    }

    // Parse and sanitize query parameters
    const {
      position = "", // default: any position
      minExperience: rawMinExp,
      maxExperience: rawMaxExp,
    } = req.query;

    const minExperience = isNaN(Number(rawMinExp)) ? 0 : Number(rawMinExp);
    const maxExperience = isNaN(Number(rawMaxExp))
      ? Infinity
      : Number(rawMaxExp);

    console.log("[client:filtering] 🟡 Received filter parameters:", {
      position,
      minExperience,
      maxExperience,
    });

    const filtered = [];

    const call = client.FilterCandidates({
      minExperience,
      maxExperience,
      position,
    });

    call.on("data", (candidate) => {
      console.log(
        "[client:filtering] 🟡 Matching candidate received:",
        candidate
      );
      filtered.push(candidate);
    });

    call.on("end", () => {
      console.log(
        "[client:filtering] 🟢 Filtering completed. Total matches:",
        filtered.length
      );
      res.json({ filtered });
    });

    call.on("error", (err) => {
      console.error("[client:filtering] ❌ Error filtering candidates:", err);
      res.status(500).json({ message: "Failed to filter candidates" });
    });
  } catch (err) {
    console.error("[client:filtering] ❌ Unexpected error:", err);
    return res.status(500).json({ message: "Unexpected server error" });
  }
});

// 🗑️ Delete filtered candidate
app.delete("/delete-filtered/:id", async (req, res) => {
  console.log("[client:filtering] 🟡 Starting to delete filtered candidate...");

  try {
    const client = await getGrpcClient(
      "FilteringService",
      "filtering.proto",
      "filtering",
      "FilteringService"
    );
    if (!client) {
      console.error(
        "[client:filtering] ❌ FilteringService client is not available"
      );
      return res
        .status(500)
        .json({ message: "FilteringService not available" });
    }

    const { id } = req.params;

    console.log(
      "[client:filtering] 🟡 Request to delete candidate with ID:",
      id
    );

    client.DeleteCandidate({ id }, (err, response) => {
      if (err) {
        console.error(
          "[client:filtering] ❌ gRPC DeleteCandidate error:",
          err.message
        );
        return res.status(500).json({ message: "Failed to delete candidate" });
      }

      console.log(
        "[client:filtering] 🟢 Candidate deleted successfully:",
        response
      );

      return res.json({
        message: response.message,
        id: response.id,
      });
    });
  } catch (err) {
    console.error("[client:filtering] ❌ Unexpected error:", err);
    return res.status(500).json({ message: "Unexpected server error" });
  }
});

// 📅 Schedule interview (InterviewService)
app.post("/schedule-interviews", async (req, res) => {
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
});

// ✏️ Edit interview
app.put("/update-interview/:id", async (req, res) => {
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
});

// 🗑️ Delete interview
app.delete("/delete-interview/:id", async (req, res) => {
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
});

app.get("/", (req, res) => {
  res.render("index");
});

const PORT = process.env.CLIENT_PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Client GUI running on http://localhost:${PORT}`);
});
