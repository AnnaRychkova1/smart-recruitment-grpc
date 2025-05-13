import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import fetch from "node-fetch";
import { Candidate } from "../../models/Candidate.js";
import { verifyTokenFromCallMetadata } from "../../middleware/verifyTokenFromCallMetadata.js";
import { analyzeCVAndExtractCandidate } from "../../helpers/analyzeCVAndExtractCandidate.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🔌 Connecting to MongoDB...");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
};

// Define the path to the .proto file
const PROTO_PATH = path.join(process.cwd(), "proto", "hiring.proto");

// Load and parse the protobuf definition
const packageDef = protoLoader.loadSync(PROTO_PATH);
const hiringProto = grpc.loadPackageDefinition(packageDef).hiring;

// Function to add candidate
async function AddCandidate(call, callback) {
  // try {
  verifyTokenFromCallMetadata(call);
  // } catch (err) {
  //   return callback({
  //     code: grpc.status.UNAUTHENTICATED,
  //     message: "Invalid or missing token.",
  //   });
  // }
  const candidate = call.request;

  try {
    // const existing = await candidatesCollection.findOne({ email: candidate.email });
    // if (existing) {
    //   return callback(null, {
    //     status: 409,
    //     message: "Conflict: Candidate with this ID already exists.",
    //     candidate: existing,
    //   });
    // }

    if (
      !candidate.name ||
      !candidate.email ||
      !candidate.position ||
      candidate.experience < 0 ||
      !candidate.pathCV
    ) {
      return callback(
        {
          status: 400, // 400 Bad Request
          message:
            "Bad Request: All fields (id, name, email, position, experience, pathCV) are required.",
          candidate: null,
        },

        null
      );
    }

    if (typeof candidate.experience !== "number" || candidate.experience < 0) {
      return callback(
        {
          status: 422, // 422 Unprocessable Entity
          message:
            "Unprocessable Entity: Experience must be a positive number.",
          candidate: null,
        },
        null
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(candidate.email)) {
      return callback(
        {
          status: 422, // 422 Unprocessable Entity
          message: "Unprocessable Entity: Invalid email format.",
          candidate: null,
        },
        null
      );
    }

    // Add candidate to DB
    const newCandidate = new Candidate(candidate);
    await newCandidate.save();
    // await candidatesCollection.insertOne(candidate);
    console.log(`📥 Candidate ${candidate.name} added to DB`);

    // Response
    callback(null, {
      status: 201, // 201 Created
      message: `📥 Candidate ${candidate.name} created successfully.`,
      candidate: newCandidate.toObject(),
    });
  } catch (err) {
    console.error("❌ DB Insert Error:", err.message);
    callback(null, {
      status: 500,
      message: "Internal Server Error: Unable to add candidate.",
      candidate: null,
    });
  }
}

// Add many candidates (via stream of pathCVs only)
async function AddManyCandidates(call, callback) {
  try {
    verifyTokenFromCallMetadata(call);
  } catch (err) {
    return callback({
      code: grpc.status.UNAUTHENTICATED,
      message: "Invalid or missing token.",
    });
  }

  console.log("📥 Starting AddManyCandidates stream...");

  const insertedCandidates = [];
  const failed = [];
  const savePromises = [];

  call.on("data", (candidateChunk) => {
    const { pathCV } = candidateChunk;

    console.log("📄 Received pathCV:", pathCV);

    if (!pathCV) {
      console.warn("⚠️ Skipping candidate without pathCV.");
      failed.push({ error: "Missing pathCV", pathCV });
      return;
    }

    const savePromise = (async () => {
      try {
        const candidateData = await analyzeCVAndExtractCandidate(pathCV);

        const newCandidate = new Candidate({
          ...candidateData,
          pathCV,
        });

        const saved = await newCandidate.save();
        console.log(`✅ Saved candidate with CV: ${saved.pathCV}`);
        insertedCandidates.push(saved);
      } catch (err) {
        console.error(
          `❌ Failed to save candidate with CV: ${pathCV}`,
          err.message
        );
        failed.push({ error: err.message, pathCV });
      }
    })();

    savePromises.push(savePromise);
  });

  call.on("end", async () => {
    await Promise.all(savePromises);

    const addedCount = insertedCandidates.length;
    console.log(
      `🟢 Stream ended. Inserted: ${addedCount}, Failed: ${failed.length}`
    );

    callback(null, {
      addedCount,
      message: `Processed ${addedCount} candidates. ${failed.length} failed.`,
    });
  });

  call.on("error", (err) => {
    console.error("❌ Stream error during AddManyCandidates:", err.message);
    callback({
      code: grpc.status.INTERNAL,
      message: "Internal error during AddManyCandidates stream.",
    });
  });
}

// Function to handle retrieving all candidates
async function GetAllCandidates(call) {
  try {
    verifyTokenFromCallMetadata(call);
  } catch (err) {
    return callback({
      code: grpc.status.UNAUTHENTICATED,
      message: "Invalid or missing token.",
    });
  }
  console.log("📤 Fetching candidates from DB...");

  try {
    // const candidatesArray = await candidatesCollection.find().toArray();
    const candidatesArray = await Candidate.find();

    if (candidatesArray.length === 0) {
      console.log("🔴 No candidates found. Ending stream cleanly.");
      return call.end();
    }

    for (const candidate of candidatesArray) {
      call.write(candidate);
    }

    console.log("🟢 Candidates streamed successfully.");
    call.end();
  } catch (err) {
    console.error(`❌ DB Fetch Error: ${err.name}: ${err.message}`);
    call.destroy({
      code: grpc.status.INTERNAL,
      message: "Failed to fetch candidates from the database.",
    });
  }
}

// Function to handle updating an existing candidate
async function UpdateCandidate(call, callback) {
  try {
    verifyTokenFromCallMetadata(call);
  } catch (err) {
    return callback({
      code: grpc.status.UNAUTHENTICATED,
      message: "Invalid or missing token.",
    });
  }
  const toUpdate = call.request;
  try {
    // Basic validation
    if (
      !toUpdate._id ||
      !toUpdate.name ||
      !toUpdate.email ||
      !toUpdate.position ||
      typeof toUpdate.experience !== "number" ||
      toUpdate.experience < 0
    ) {
      return callback(null, {
        status: 400,
        message: "Bad Request: All fields must be provided and valid.",
        candidate: null,
      });
    }

    const updatedCandidate = await Candidate.findByIdAndUpdate(
      toUpdate._id,
      {
        name: toUpdate.name,
        email: toUpdate.email,
        position: toUpdate.position,
        experience: toUpdate.experience,
        ...(toUpdate.pathCV && { pathCV: toUpdate.pathCV }),
      },
      { new: true }
    );

    if (!updatedCandidate) {
      return callback(null, {
        status: 404,
        message: `Not Found: Candidate with ID ${toUpdate._id} does not exist.`,
        candidate: null,
      });
    }

    console.log(`✏️ Candidate ${updatedCandidate.name} updated successfully.`);

    callback(null, {
      status: 200,
      message: `Candidate ${updatedCandidate.name} updated successfully.`,
      candidate: updatedCandidate.toObject(),
    });
  } catch (err) {
    console.error("❌ DB Update Error:", err.message);
    callback(null, {
      status: 500,
      message: "Internal Server Error: Unable to update candidate.",
      candidate: null,
    });
  }
}

// Function to handle deleting a candidate
async function DeleteCandidate(call, callback) {
  try {
    verifyTokenFromCallMetadata(call);
  } catch (err) {
    return callback({
      code: grpc.status.UNAUTHENTICATED,
      message: "Invalid or missing token.",
    });
  }
  const { id } = call.request;

  try {
    const deleted = await Candidate.findByIdAndDelete(id);

    if (!deleted) {
      return callback(null, {
        message: `Candidate with ID ${id} not found.`,
        id,
      });
    }

    console.log(
      `🗑️ Deleted candidate ${deleted.name} from candidates collection.`
    );

    callback(null, {
      message: `Candidate ${deleted.name} deleted successfully.`,
      id: deleted._id.toString(),
    });
  } catch (error) {
    console.error("❌ Error deleting candidate:", error.message);
    callback({
      code: grpc.status.INTERNAL,
      message: "Server error while deleting candidate.",
    });
  }
}

// Create a new gRPC server instance
const server = new grpc.Server();

// Add the HiringService with its methods to the server
server.addService(hiringProto.HiringService.service, {
  AddCandidate,
  AddManyCandidates,
  GetAllCandidates,
  UpdateCandidate,
  DeleteCandidate,
});

// Define the port and host for the server
const PORT = process.env.HIRING_PORT || 50051; // Default to port 50051 if not set
const HOST = "localhost";

// Bind the server to the specified address and port
connectDB()
  .then(() => {
    server.bindAsync(
      `0.0.0.0:${PORT}`,
      grpc.ServerCredentials.createInsecure(),
      () => {
        console.log(`🚀 HiringService running on port ${PORT}`);

        // Register with service discovery
        fetch("http://localhost:3001/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceName: "HiringService",
            host: HOST,
            port: PORT,
          }),
        })
          .then((res) => res.json())
          .then((data) => console.log("📡 Registered with discovery:", data))
          .catch((err) =>
            console.error("❌ Discovery registration failed:", err)
          );
      }
    );
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1); // Exit if DB connection fails
  });
