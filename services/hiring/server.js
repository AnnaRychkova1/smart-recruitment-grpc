import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { MongoClient } from "mongodb";
import { ObjectId } from "mongodb";

dotenv.config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;
let candidatesCollection;

async function connectDB() {
  await client.connect();
  db = client.db("hiring-db");
  candidatesCollection = db.collection("candidates");
  console.log("✅ Connected to MongoDB");
}

// Define the path to the .proto file
const PROTO_PATH = path.join(process.cwd(), "proto", "hiring.proto");

// Load and parse the protobuf definition
const packageDef = protoLoader.loadSync(PROTO_PATH);
const hiringProto = grpc.loadPackageDefinition(packageDef).hiring;

// Function to add candidate
async function AddCandidate(call, callback) {
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
    await candidatesCollection.insertOne(candidate);
    console.log(`📥 Candidate ${candidate.name} added to DB`);

    // Response
    callback(null, {
      status: 201, // 201 Created
      message: `📥 Candidate ${candidate.name} created successfully.`,
      candidate: candidate,
    });
  } catch (err) {
    console.error("❌ DB Insert Error:", err.message);
    callback(null, {
      status: 500,
      message: "Internal Server Error: Unable to add candidate.",
      candidate: null,
      error: err.message,
    });
  }
}

// Function to handle retrieving all candidates
async function GetAllCandidates(call) {
  console.log("📤 Fetching candidates from DB...");

  try {
    const candidatesArray = await candidatesCollection.find().toArray();

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

    // Check if candidate exists
    const existing = await candidatesCollection.findOne({
      _id: new ObjectId(toUpdate._id),
    });

    if (!existing) {
      return callback(null, {
        status: 404,
        message: `Not Found: Candidate with ID ${toUpdate._id} does not exist.`,
        candidate: null,
      });
    }

    const updateFields = {
      name: toUpdate.name,
      email: toUpdate.email,
      position: toUpdate.position,
      experience: toUpdate.experience,
    };

    if (toUpdate.pathCV) {
      updateFields.pathCV = toUpdate.pathCV;
    }

    const result = await candidatesCollection.updateOne(
      { _id: new ObjectId(toUpdate._id) },
      { $set: updateFields }
    );

    const updated = await candidatesCollection.findOne({
      _id: new ObjectId(toUpdate._id),
    });

    if (result.status === 200) {
      console.log(
        `✏️ Candidate ${updated.name} with ID ${updated._id} updated successfully.`
      );
    } else {
      console.log(` Candidate ${updated.name} was not updated successfully.`);
    }

    // Respond with success
    callback(null, {
      status: 200,
      message: `Candidate ${updated.name} updated successfully.`,
      candidate: updated,
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
  const { id } = call.request;

  try {
    const objectId = new ObjectId(id);

    const candidate = await candidatesCollection.findOne({ _id: objectId });
    const result = await candidatesCollection.deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return callback(null, {
        message: `Candidate with ID ${id} not found.`,
        id: id,
      });
    }

    const name = candidate?.name || "(unknown)";
    console.log(`🗑️ Deleted candidate ${name} from candidates collection.`);

    callback(null, {
      message: `Candidate ${name} deleted successfully.`,
      id: candidate._id.toString(),
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
