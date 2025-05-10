import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs/promises";
import pdfParse from "pdf-parse";
import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import { Filtered } from "../../models/Filtered.js";
import { analyzeCVWithAI } from "../../helpers/analyzeCVWithAI.js";
import { verifyTokenFromCallMetadata } from "../../middleware/verifyTokenFromCallMetadata.js";

dotenv.config();

// ---- MongoDB Setup ----
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db;
let candidatesCollection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("hiring-db");
    candidatesCollection = db.collection("candidates");
    console.log("✅ MongoClient connected.");

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Mongoose connected.");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    throw err;
  }
}

// ---- Proto Setup ----
const PROTO_PATH = path.join(process.cwd(), "proto", "filtering.proto");
const packageDef = protoLoader.loadSync(PROTO_PATH);
const filteringProto = grpc.loadPackageDefinition(packageDef).filtering;

// ---- FilterCandidates RPC Method ----
async function FilterCandidates(call, callback) {
  try {
    verifyTokenFromCallMetadata(call);
  } catch (err) {
    return callback({
      code: grpc.status.UNAUTHENTICATED,
      message: "Invalid or missing token.",
    });
  }
  const { minExperience, maxExperience, position } = call.request;
  console.log("📥 Filtering candidates...", {
    minExperience,
    maxExperience,
    position,
  });

  try {
    await Filtered.deleteMany({});
    console.log("🧹 Cleared previously filtered candidates.");

    const minExp =
      typeof minExperience === "number" && minExperience >= 0
        ? minExperience
        : 0;
    const maxExp =
      typeof maxExperience === "number" && maxExperience > 0
        ? maxExperience
        : Infinity;
    const pos = position?.trim();

    const query = {
      experience: { $gte: minExp, $lte: maxExp },
    };

    if (pos) {
      query.position = { $regex: new RegExp(`^${pos}$`, "i") };
    }

    const candidates = await candidatesCollection.find(query).toArray();

    if (candidates.length === 0) {
      console.log("🔴 No candidates match the filtering criteria.");
      return call.end();
    }

    let count = 0;

    for (const c of candidates) {
      if (!c.pathCV) {
        console.warn(`⚠️ Skipping candidate ${c.name}: CV path missing.`);
        continue;
      }

      try {
        const cvPath = path.resolve(process.cwd(), c.pathCV);
        const buffer = await fs.readFile(cvPath);
        const parsed = await pdfParse(buffer);
        const aiResult = await analyzeCVWithAI(parsed.text, position);

        if (aiResult.relevant) {
          // await filteredCollection.insertOne(c);
          await Filtered.create(c);
          call.write(c);
          count++;
        } else {
          console.log(
            `🧠 Candidate ${c.name} with ID ${c._id} was not relevant.`
          );
        }
      } catch (cvErr) {
        console.warn(`❌ Error processing CV for ${c.name}: ${cvErr.message}`);
      }
    }

    console.log(`🟢 ${count} relevant candidate(s) filtered and saved.`);
    call.end();
  } catch (err) {
    console.error("❌ FilterCandidates Error:", err.message);
    callback({
      code: grpc.status.INTERNAL,
      message: "Server error while filtering candidates.",
    });
  }
}

// ---- DeleteCandidate RPC Method ----
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
    const candidate = await Filtered.findByIdAndDelete(id);

    if (!candidate) {
      return callback(null, {
        message: `Candidate with ID ${id} not found in filtered collection.`,
        id: id,
      });
    }

    console.log(
      `🗑️ Deleted candidate ${candidate.name} from filtered collection.`
    );

    callback(null, {
      message: `Candidate ${candidate.name} deleted successfully.`,
      id: candidate._id.toString(),
    });
  } catch (err) {
    console.error("❌ DeleteCandidate Error:", err.message);
    callback({
      code: grpc.status.INTERNAL,
      message: "Server error while deleting candidate.",
    });
  }
}

// ---- gRPC Server Initialization ----
const server = new grpc.Server();

server.addService(filteringProto.FilteringService.service, {
  FilterCandidates,
  DeleteCandidate,
});

const PORT = process.env.FILTERING_PORT || 50052;
const HOST = "localhost";

// ---- Start Server After DB Connection ----
connectDB()
  .then(() => {
    server.bindAsync(
      `0.0.0.0:${PORT}`,
      grpc.ServerCredentials.createInsecure(),
      () => {
        console.log(`🚀 FilteringService running on port ${PORT}`);

        // Register with discovery service
        fetch("http://localhost:3001/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceName: "FilteringService",
            host: HOST,
            port: PORT,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            console.log("📡 Registered with discovery:", data);
          })
          .catch((err) => {
            console.error("❌ Discovery registration failed:", err.message);
          });
      }
    );
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
