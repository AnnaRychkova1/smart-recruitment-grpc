import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import { Interview } from "../../models/Interview.js";
import { verifyTokenFromCallMetadata } from "../../middleware/verifyTokenFromCallMetadata.js";

dotenv.config();

// ---- MongoDB Setup ----
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;
let filteredCollection;

async function connectDB() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await client.connect();
    db = client.db("hiring-db");
    filteredCollection = db.collection("filtereds");
    console.log("✅ MongoClient connected.");

    await mongoose.connect(uri);
    console.log("✅ Mongoose connected.");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    throw err;
  }
}

// ---- Proto Setup ----
const PROTO_PATH = path.join(process.cwd(), "proto", "interview.proto");
const packageDef = protoLoader.loadSync(PROTO_PATH);
const interviewProto = grpc.loadPackageDefinition(packageDef).interview;

// ---- ScheduleInterviews RPC Method ----
async function ScheduleInterviews(call, callback) {
  console.log("📨 Received ScheduleInterviews RPC");

  try {
    verifyTokenFromCallMetadata(call);
    console.log("🔑 Token verified");
  } catch (err) {
    console.warn("🚫 Unauthorized ScheduleInterviews attempt");
    return callback({
      code: grpc.status.UNAUTHENTICATED,
      message: "Invalid or missing token.",
    });
  }

  try {
    await Interview.deleteMany({});
    console.log("🧹 Cleared previously scheduled interviews.");

    let { date } = call.request;
    console.log(`📥 Scheduling interviews for ${date}`);

    const candidates = await filteredCollection.find().toArray();
    console.log(`👥 Candidates found: ${candidates.length}`);

    if (!candidates.length) {
      console.warn("⚠️ No candidates found in filtered collection.");
      return callback(null, {
        message: "No candidates available to schedule interviews.",
        scheduled: [],
      });
    }

    const interviewDuration = 60;
    let workStart = new Date(`${date}T09:00:00`);
    let lunchStart = new Date(`${date}T13:00:00`);
    let lunchEnd = new Date(`${date}T14:00:00`);
    let workEnd = new Date(`${date}T18:00:00`);

    let current = new Date(workStart);
    const scheduled = [];

    for (const candidate of candidates) {
      if (current >= lunchStart && current < lunchEnd) {
        console.log("🍽️ Skipping lunch hour.");
        current = new Date(lunchEnd);
      }

      if (current >= workEnd) {
        console.log("⏰ Day ended, rolling to next day.");
        const nextDay = new Date(date);
        nextDay.setDate(current.getDate() + 1);

        date = nextDay.toISOString().split("T")[0];
        workStart = new Date(`${date}T09:00:00`);
        lunchStart = new Date(`${date}T13:00:00`);
        lunchEnd = new Date(`${date}T14:00:00`);
        workEnd = new Date(`${date}T18:00:00`);
        current = new Date(workStart);
      }

      const interview = {
        name: candidate.name,
        date: current.toISOString().split("T")[0],
        time: current.toTimeString().slice(0, 5),
      };
      const newInterview = new Interview(interview);
      await newInterview.save();

      scheduled.push({
        _id: newInterview.id.toString(),
        name: newInterview.name,
        date: newInterview.date,
        time: newInterview.time,
      });

      console.log(`🟢 Scheduled: ${interview.name} at ${interview.time}`);
      current = new Date(current.getTime() + interviewDuration * 60 * 1000);
    }

    console.log(`✅ Successfully scheduled ${scheduled.length} interview(s).`);

    callback(null, {
      message: `Successfully scheduled ${scheduled.length} interview(s) on ${date}`,
      scheduled,
    });
  } catch (err) {
    console.error("❌ ScheduleInterviews Error:", err.message);
    callback({
      code: grpc.status.INTERNAL,
      message: "Server error while scheduling interviews.",
    });
  }
}

// ---- UpdateInterview RPC Method ----
async function UpdateInterview(call, callback) {
  console.log("📨 Received UpdateInterview RPC");

  try {
    verifyTokenFromCallMetadata(call);
    console.log("🔑 Token verified");
  } catch (err) {
    console.warn("🚫 Unauthorized UpdateInterview attempt");
    return callback({
      code: grpc.status.UNAUTHENTICATED,
      message: "Invalid or missing token.",
    });
  }

  const { id, newDate, newTime } = call.request;
  console.log(`🛠️ Request to update interview ${id} to ${newDate} ${newTime}`);

  if (!id || !newDate || !newTime) {
    console.warn("⚠️ Missing required fields.");
    return callback(null, {
      message: "All fields (id, newDate, newTime) are required.",
      updated: null,
    });
  }

  try {
    const existingInterviews = await Interview.find({ date: newDate });
    console.log(
      `🔍 Checking conflicts with ${existingInterviews.length} interviews`
    );

    for (const interview of existingInterviews) {
      const interviewStart = new Date(`${newDate}T${newTime}:00`);
      const interviewEnd = new Date(interviewStart.getTime() + 60 * 60 * 1000);
      const existingStart = new Date(`${newDate}T${interview.time}:00`);
      const existingEnd = new Date(existingStart.getTime() + 60 * 60 * 1000);

      if (
        (interviewStart < existingEnd && interviewStart >= existingStart) ||
        (interviewEnd > existingStart && interviewEnd <= existingEnd)
      ) {
        console.warn("⚠️ Time conflict detected.");
        return callback({
          code: grpc.status.ALREADY_EXISTS,
          message:
            "The interview time overlaps with an existing interview. Please ensure there is at least one hour between interviews.",
          updated: null,
        });
      }
    }

    const interview = await Interview.findByIdAndUpdate(
      id,
      { date: newDate, time: newTime },
      { new: true }
    );

    if (!interview) {
      console.warn("⚠️ Interview not found.");
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `Interview with ID ${id} not found.`,
        updated: null,
      });
    }

    console.log(`✅ Interview ${id} updated to ${newDate} ${newTime}`);
    callback(null, {
      message: `Interview updated successfully.`,
      updated: {
        _id: interview.id.toString(),
        name: interview.name,
        date: interview.date,
        time: interview.time,
      },
    });
  } catch (err) {
    console.error("❌ UpdateInterview Error:", err.message);
    callback({
      code: grpc.status.INTERNAL,
      message: "Error while updating interview.",
      updated: null,
    });
  }
}

// ---- DeleteInterview RPC Method ----
async function DeleteInterview(call, callback) {
  console.log("📨 Received DeleteInterview RPC");

  try {
    verifyTokenFromCallMetadata(call);
    console.log("🔑 Token verified");
  } catch (err) {
    console.warn("🚫 Unauthorized DeleteInterview attempt");
    return callback({
      code: grpc.status.UNAUTHENTICATED,
      message: "Invalid or missing token.",
    });
  }

  const { id } = call.request;
  console.log(`🗑️ Attempting to delete interview ID ${id}`);

  try {
    const interview = await Interview.findByIdAndDelete(id);

    if (!interview) {
      console.warn("⚠️ Interview not found for deletion.");
      return callback(null, {
        message: `Interview with ID ${id} not found.`,
        id,
      });
    }

    console.log(`🗑️ Deleted interview for candidate ${interview.name}`);
    callback(null, {
      message: "Interview deleted successfully.",
      id,
    });
  } catch (err) {
    console.error("❌ DeleteInterview Error:", err.message);
    callback({
      code: grpc.status.INTERNAL,
      message: "Error deleting interview.",
    });
  }
}

// ---- Reschedule  RPC Method ----

async function StreamAndReschedule(call) {
  console.log("📨 Received StreamAndReschedule RPC");

  try {
    verifyTokenFromCallMetadata(call);
    console.log("🔑 Token verified");
  } catch (err) {
    console.warn("🚫 Unauthorized Stream attempt");
    call.emit("error", {
      code: grpc.status.UNAUTHENTICATED,
      message: "Invalid or missing token.",
    });
    return;
  }

  const savePromises = [];
  await Interview.deleteMany({});
  console.log("🧹 Cleared previously scheduled interviews.");

  const timeMap = {};

  call.on("data", (interviewChunk) => {
    console.log("📄 Received Interview Chunk:", interviewChunk);

    const interview = interviewChunk;

    const savePromise = (async () => {
      try {
        const interviewDate = interview.date;

        const availableHours = [];
        for (let hour = 9; hour < 18; hour++) {
          if (hour !== 13) {
            availableHours.push(hour);
          }
        }

        if (!timeMap[interviewDate]) {
          timeMap[interviewDate] = new Set();
        }

        const takenHours = timeMap[interviewDate];
        const freeHours = availableHours.filter(
          (hour) => !takenHours.has(hour)
        );

        if (freeHours.length === 0) {
          throw new Error(`No available hours left on ${interviewDate}`);
        }

        const randomIndex = Math.floor(Math.random() * freeHours.length);
        const chosenHour = freeHours[randomIndex];
        const newTime = `${chosenHour < 10 ? "0" + chosenHour : chosenHour}:00`;

        takenHours.add(chosenHour);

        const updatedInterview = {
          ...interview,
          time: newTime,
        };

        const saved = await Interview.create(updatedInterview);

        console.log(
          `📆 Rescheduled interview for ${saved.name} to ${saved.date} ${saved.time}`
        );

        call.write(saved.toObject());
      } catch (err) {
        console.error("❌ Error processing interview:", err.message);
      }
    })();

    savePromises.push(savePromise);
  });

  call.on("end", async () => {
    await Promise.all(savePromises);
    console.log("✅ All interviews processed and rescheduled.");
    call.end();
  });

  call.on("error", (err) => {
    console.error("❌ Stream error:", err.message);
  });
}

// ---- gRPC Server Initialization ----
const server = new grpc.Server();

server.addService(interviewProto.InterviewService.service, {
  ScheduleInterviews,
  UpdateInterview,
  DeleteInterview,
  StreamAndReschedule,
});

const PORT = process.env.INTERVIEW_PORT || 50053;
const HOST = "localhost";

connectDB().then(() => {
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    () => {
      console.log(`🚀 InterviewService running on port ${PORT}`);

      fetch("http://localhost:3001/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: "InterviewService",
          host: HOST,
          port: PORT,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("📡 Registered with discovery:", data);
        })
        .catch((err) =>
          console.error("❌ Discovery registration failed:", err.message)
        );
    }
  );
});
