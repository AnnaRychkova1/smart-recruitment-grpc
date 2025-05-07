import grpc from "@grpc/grpc-js"; // gRPC package for setting up the server
import protoLoader from "@grpc/proto-loader"; // Proto file loader for gRPC
import path from "path"; // To resolve paths to files
import dotenv from "dotenv"; // For environment variable management
import fetch from "node-fetch"; // For making HTTP requests
import { MongoClient, ObjectId } from "mongodb"; // MongoDB client and ObjectId for querying

dotenv.config(); // Load environment variables from .env file

// ---- MongoDB Setup ----
const uri = process.env.MONGO_URI; // MongoDB URI from environment variables
const client = new MongoClient(uri); // Create a MongoDB client

let db; // MongoDB database
let filteredCollection; // Collection for filtered candidates
let interviewsCollection; // Collection for scheduled interviews

// Connect to MongoDB and set up collections
async function connectDB() {
  await client.connect();
  db = client.db("hiring-db");
  filteredCollection = db.collection("filtered"); // Collection of filtered candidates
  interviewsCollection = db.collection("interviews"); // Collection for scheduled interviews
  console.log("✅ Connected to MongoDB");
}

// ---- Proto Setup ----
const PROTO_PATH = path.join(process.cwd(), "proto", "interview.proto"); // Path to gRPC Proto file
const packageDef = protoLoader.loadSync(PROTO_PATH); // Load Proto file
const interviewProto = grpc.loadPackageDefinition(packageDef).interview; // Load interview service

// ---- ScheduleInterviews RPC Method ----
async function ScheduleInterviews(call, callback) {
  await interviewsCollection.deleteMany({});
  console.log("🧹 Cleared previously scheduled interviews.");
  const { date } = call.request; // Get the interview date from the request

  console.log(`📥 Scheduling interviews for ${date}`);

  try {
    const candidates = await filteredCollection.find().toArray(); // Get all filtered candidates

    if (!candidates.length) {
      // Check if there are no candidates
      console.warn("⚠️ No candidates found in filtered collection.");
      return callback(null, {
        message: "No candidates available to schedule interviews.",
        scheduled: [],
      });
    }

    // Interview scheduling logic
    const interviewDuration = 60; // Set interview duration to 60 minutes
    const workStart = new Date(`${date}T09:00:00`); // Workday starts at 9:00 AM
    const lunchStart = new Date(`${date}T13:00:00`); // Lunch break starts at 1:00 PM
    const lunchEnd = new Date(`${date}T14:00:00`); // Lunch break ends at 2:00 PM
    const workEnd = new Date(`${date}T18:00:00`); // Workday ends at 6:00 PM

    let current = new Date(workStart); // Start scheduling interviews from 9:00 AM
    const scheduled = []; // Array to store scheduled interviews

    // Loop through candidates and schedule interviews
    for (const candidate of candidates) {
      if (current >= lunchStart && current < lunchEnd) {
        current = new Date(lunchEnd); // Skip lunch break time
      }

      if (current >= workEnd) {
        // Stop if there are no more available slots
        console.warn("⏰ No more available slots for the day.");
        break;
      }

      const interview = {
        candidateId: candidate._id,
        name: candidate.name,
        date,
        time: current.toTimeString().slice(0, 5), // Set interview time
      };

      await interviewsCollection.insertOne(interview); // Insert interview into the database
      scheduled.push(interview); // Add interview to the scheduled array

      console.log(`🟢 Scheduled: ${candidate.name} at ${interview.time}`);

      current = new Date(current.getTime() + interviewDuration * 60 * 1000); // Move to the next available slot
    }

    callback(null, {
      message: `Successfully scheduled ${scheduled.length} interview(s) on ${date}`,
      scheduled, // Return the scheduled interviews
    });
  } catch (err) {
    console.error("❌ ScheduleInterviews Error:", err.message); // Log error
    callback({
      code: grpc.status.INTERNAL,
      message: "Server error while scheduling interviews.", // Send error response
    });
  }
}

// ---- EditInterview RPC Method ----
async function UpdateInterview(call, callback) {
  console.log(call.request);
  const { id, newDate, newTime } = call.request;
  console.log(id, newTime, newDate);
  try {
    // Basic validation
    if (!id || !newDate || !newTime) {
      return callback(null, {
        status: 400,
        message: "Bad Request: All fields must be provided and valid.",
        updated: null,
      });
    }

    // Check if candidate exists
    const existing = await interviewsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!existing) {
      return callback(null, {
        status: 404,
        message: `Not Found: Candidate with ID ${id} does not exist.`,
        updated: null,
      });
    }

    const updateFields = {
      date: newDate,
      time: newTime,
    };

    const result = await interviewsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    const interview = await interviewsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (result.status === 200) {
      console.log(
        `✏️ Interview ${interview.name} with ID ${interview._id} updated successfully.`
      );
    } else {
      console.log(`Interview ${interview.name} was not updated successfully.`);
    }

    // Respond with success
    callback(null, {
      status: 200,
      message: `Interview ${interview.name} updated successfully.`,
      updated: interview,
    });
  } catch (err) {
    console.error("❌ DB Update Error:", err.message);
    callback(null, {
      status: 500,
      message: "Internal Server Error: Unable to update candidate.",
      updated: null,
    });
  }
}

// ---- DeleteInterview RPC Method ----
async function DeleteInterview(call, callback) {
  const { id } = call.request;

  try {
    const objectId = new ObjectId(id);

    const interview = await interviewsCollection.findOne({ _id: objectId });
    const result = await interviewsCollection.deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return callback(null, {
        message: `Interview with ID ${id} not found in interview collection.`,
        id,
      });
    }

    const name = interview?.name || "(unknown)";
    console.log(`🗑️ Deleted interview for ${name} from interview collection.`);

    callback(null, {
      message: `Interview ${name} deleted successfully.`,
      id: interview._id.toString(),
    });
  } catch (err) {
    console.error("❌ Delete Interview Error:", err.message);
    callback({
      code: grpc.status.INTERNAL,
      message: "Server error while deleting interview.",
    });
  }
}

// ---- gRPC Server Initialization ----
const server = new grpc.Server(); // Create a new gRPC server

server.addService(interviewProto.InterviewService.service, {
  ScheduleInterviews,
  UpdateInterview,
  DeleteInterview,
}); // Register the RPC methods to the server

const PORT = process.env.INTERVIEW_PORT || 50053; // Port for the server
const HOST = "localhost"; // Host for the server

// ---- Start Server After DB Connection ----
connectDB() // Connect to the database
  .then(() => {
    server.bindAsync(
      `0.0.0.0:${PORT}`, // Bind the server to all interfaces on the specified port
      grpc.ServerCredentials.createInsecure(),
      () => {
        console.log(`🚀 InterviewService running on port ${PORT}`);

        // Register with a discovery service to be discoverable
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
            console.log("📡 Registered with discovery:", data); // Log successful registration
          })
          .catch((err) => {
            console.error("❌ Discovery registration failed:", err.message); // Log failed registration
          });
      }
    );
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err.message); // Log connection failure
    process.exit(1); // Exit the process if DB connection fails
  });
