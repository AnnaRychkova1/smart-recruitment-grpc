import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import { Interview } from "../../models/Interview.js";

dotenv.config();

// ---- MongoDB Setup ----
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;
let filteredCollection;

async function connectDB() {
  try {
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
  try {
    await Interview.deleteMany({});
    console.log("🧹 Cleared previously scheduled interviews.");

    let { date } = call.request;
    console.log(`📥 Scheduling interviews for ${date}`);

    const candidates = await filteredCollection.find().toArray();

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
        current = new Date(lunchEnd);
      }

      // If we've reached the end of the workday, move to the next day
      if (current >= workEnd) {
        const nextDay = new Date(date);
        nextDay.setDate(current.getDate() + 1); // Add one day

        date = nextDay.toISOString().split("T")[0];
        workStart = new Date(`${date}T09:00:00`);
        lunchStart = new Date(`${date}T13:00:00`);
        lunchEnd = new Date(`${date}T14:00:00`);
        workEnd = new Date(`${date}T18:00:00`);
        current = new Date(workStart);

        console.log(
          `⏰ No more available slots for today. Moving to the next day!`
        );
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
  const { id, newDate, newTime } = call.request;

  if (!id || !newDate || !newTime) {
    return callback(null, {
      status: 400,
      message: "All fields (id, newDate, newTime) are required.",
      updated: null,
    });
  }

  try {
    // Check if there are any interviews on the same date
    const existingInterviews = await Interview.find({ date: newDate });

    // Check if the time of the new interview overlaps with any existing interviews
    for (const interview of existingInterviews) {
      // Calculate the start and end time of the new interview
      const interviewStart = new Date(`${newDate}T${newTime}:00`);
      const interviewEnd = new Date(interviewStart.getTime() + 60 * 60 * 1000); // Interview duration is 1 hour

      // Calculate the start and end time of the existing interview
      const existingInterviewStart = new Date(
        `${newDate}T${interview.time}:00`
      );
      const existingInterviewEnd = new Date(
        existingInterviewStart.getTime() + 60 * 60 * 1000
      ); // 1-hour interview duration

      // Check if the new interview overlaps with an existing interview
      if (
        (interviewStart < existingInterviewEnd &&
          interviewStart >= existingInterviewStart) || // New interview starts during the existing one
        (interviewEnd > existingInterviewStart &&
          interviewEnd <= existingInterviewEnd) // New interview ends during the existing one
      ) {
        return callback(null, {
          status: 400,
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
      return callback(null, {
        status: 404,
        message: `Interview with ID ${id} not found.`,
        updated: null,
      });
    }

    // ця перевірка має бути тут. У
    callback(null, {
      status: 200,
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
    callback(null, {
      status: 500,
      message: "Error while updating interview.",
      updated: null,
    });
  }
}

// ---- DeleteInterview RPC Method ----
async function DeleteInterview(call, callback) {
  const { id } = call.request;

  try {
    const interview = await Interview.findByIdAndDelete(id);

    if (!interview) {
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

// ---- gRPC Server Initialization ----
const server = new grpc.Server();

server.addService(interviewProto.InterviewService.service, {
  ScheduleInterviews,
  UpdateInterview,
  DeleteInterview,
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
