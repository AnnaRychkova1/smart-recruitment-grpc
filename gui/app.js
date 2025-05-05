// app.js

import express from "express";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import dotenv from "dotenv";
import multer from "multer";
import fetch from "node-fetch";

dotenv.config();
const grpcClients = {};
const loadedProtos = {};

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

async function getGrpcClient(
  serviceName,
  protoFile,
  packageName,
  grpcServiceName
) {
  if (grpcClients[serviceName]) {
    return grpcClients[serviceName];
  }

  console.log(`🔍 Looking up "${serviceName}" from discovery...`);

  async function fetchServiceInfo() {
    try {
      const res = await fetch(`http://localhost:3001/services/${serviceName}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error("❌ Failed to fetch service info:", err);
      return null;
    }
  }

  const serviceInfo = await fetchServiceInfo();

  if (!serviceInfo) {
    console.error(`❌ Service "${serviceName}" not found in registry.`);
    return null;
  }

  const { host, port } = serviceInfo;
  if (!host || !port) {
    console.warn(`⚠️ Invalid service info for "${serviceName}".`);
    return null;
  }

  const cacheKey = `${protoFile}-${packageName}`;
  let proto;

  if (loadedProtos[cacheKey]) {
    proto = loadedProtos[cacheKey];
  } else {
    const protoPath = path.join(process.cwd(), "proto", protoFile);
    const packageDef = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    proto = grpc.loadPackageDefinition(packageDef);
    loadedProtos[cacheKey] = proto;
  }

  const Service = proto[packageName]?.[grpcServiceName];
  if (!Service) {
    console.error(
      `❌ gRPC service "${grpcServiceName}" not found in package "${packageName}".`
    );
    return null;
  }

  const client = new Service(
    `${host}:${port}`,
    grpc.credentials.createInsecure()
  );
  grpcClients[serviceName] = client;

  console.log(`✅ Connected to "${serviceName}" at ${host}:${port}`);
  return client;
}

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

    const { id, name, email, position, experience } = req.body;
    const pathCV = req.file?.path || "";

    console.log("[client:hiring] 🟡 Received data to add candidate:", {
      id,
      name,
      email,
      position,
      experience: parseInt(experience),
      pathCV,
    });

    //  gRPC
    client.AddCandidate(
      {
        id,
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

        console.log(
          "[client:hiring] 🟢 Candidate added successfully:",
          response
        );
        return res.json({ message: response.message });
      }
    );
  } catch (err) {
    console.error("[client:hiring] ❌ Unexpected error:", err);
    return res.status(500).json({ message: "Unexpected server error" });
  }
});

// 📥 Get candidates (HiringService)
app.get("/candidates", async (req, res) => {
  console.log("[client:hiring] 🟡 Fetching all candidates...");
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

    const call = client.GetAllCandidates({});
    const candidates = [];

    call.on("data", (candidate) => {
      candidates.push(candidate);
      console.log("[client:hiring] 🟡 Received candidate:", candidate); // Logging each received candidate
    });

    call.on("end", () => {
      console.log(
        "[client:hiring] 🟢 All candidates fetched successfully. Total candidates:",
        candidates.length
      );
      res.json({ candidates });
    });

    call.on("error", (err) => {
      console.error("[client:hiring] ❌ Error fetching candidates:", err);
      res.status(500).json({ message: "Failed to get candidates" });
    });
  } catch (err) {
    console.error("[client:hiring] ❌ Unexpected error:", err);
    return res.status(500).json({ message: "Unexpected server error" });
  }
});

// ✏️ Edit candidate
app.put("/edit-candidate", upload.single("pathCV"), async (req, res) => {
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

    const { id, name, email, position, experience, existingPathCV } = req.body;
    const pathCV = req.file?.path || existingPathCV || "";

    console.log("[client:hiring] 🟡 Received data to update candidate:", {
      id,
      name,
      email,
      position,
      experience: parseInt(experience),
      pathCV,
    });

    client.UpdateCandidate(
      {
        id,
        name,
        email,
        position,
        experience: parseInt(experience),
        pathCV,
      },
      (err, response) => {
        if (err) {
          console.error("[client:hiring] ❌ gRPC UpdateCandidate error:", err);
          return res
            .status(500)
            .json({ message: "Failed to update candidate" });
        }

        console.log(
          "[client:hiring] 🟢 Candidate updated successfully:",
          response
        );
        return res.json({ message: response.message });
      }
    );
  } catch (err) {
    console.error("[client:hiring] ❌ Unexpected error:", err);
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

    console.log("[client:hiring] 🟡 Request to delete candidate with ID:", id);

    client.DeleteCandidate({ id }, (err, response) => {
      if (err) {
        console.error("[client:hiring] ❌ gRPC DeleteCandidate error:", err);
        return res.status(500).json({ message: "Failed to delete candidate" });
      }

      console.log(
        "[client:hiring] 🟢 Candidate deleted successfully:",
        response
      );
      return res.json({ message: response.message });
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

    const {
      position,
      minExperience: rawMinExp,
      maxExperience: rawMaxExp,
    } = req.query;

    const minExperience = Number(rawMinExp);
    const maxExperience = Number(rawMaxExp);

    console.log("[client:filtering] 🟡 Received filter parameters:", {
      position,
      minExperience,
      maxExperience,
    });

    const call = client.FilterCandidates({
      minExperience,
      maxExperience,
      position,
    });

    const filtered = [];

    call.on("data", (candidate) => {
      filtered.push(candidate);
      console.log(
        "[client:filtering] 🟡 Matching candidate received:",
        candidate
      );
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
        console.error("[client:filtering] ❌ gRPC DeleteCandidate error:", err);
        return res.status(500).json({ message: "Failed to delete candidate" });
      }

      console.log(
        "[client:filtering] 🟢 Candidate deleted successfully:",
        response
      );

      return res.json({
        message: response.message,
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

  const { date, candidates } = req.body;

  console.log("[client:interview] 🟡 Received scheduling data:", {
    date,
    candidates,
  });

  if (!Array.isArray(candidates) || !date) {
    console.error("[client:interview] ❌ Invalid input data for scheduling");
    return res.status(400).json({ message: "Invalid input" });
  }

  client.ScheduleInterviews({ date, candidates }, (err, response) => {
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
app.put("/edit-interview", async (req, res) => {
  console.log("[client:interview] 🟡 Starting to edit an interview...");

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

  const { id, new_date, new_time } = req.body;

  console.log("[client:interview] 🟡 Editing interview with data:", {
    id,
    new_date,
    new_time,
  });

  client.EditInterview({ id, new_date, new_time }, (err, response) => {
    if (err) {
      console.error("[client:interview] ❌ gRPC EditInterview error:", err);
      return res.status(500).json({ message: "Failed to edit interview" });
    }

    console.log(
      "[client:interview] 🟢 Interview edited successfully:",
      response.message
    );
    return res.json({
      message: response.message,
      updated: response.updated,
    });
  });
});

// 🗑️ Delete interview
app.delete("/delete-interview/:id", async (req, res) => {
  const { id } = req.params;
  console.log(
    "[client:interview] 🟡 Starting to delete interview with ID:",
    id
  );

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

  client.DeleteInterview({ id }, (err, response) => {
    if (err) {
      console.error("[client:interview] ❌ gRPC DeleteInterview error:", err);
      return res.status(500).json({ message: "Failed to delete interview" });
    }

    console.log(
      "[client:interview] 🟢 Interview deleted successfully:",
      response
    );
    return res.json({
      message: response.message,
      id: response.id,
    });
  });
});

app.get("/", (req, res) => {
  res.render("index");
});

const PORT = process.env.CLIENT_PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Client GUI running on http://localhost:${PORT}`);
});
