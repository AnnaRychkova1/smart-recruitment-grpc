import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs/promises";
import pdfParse from "pdf-parse";
import { MongoClient, ObjectId } from "mongodb";
import { analyzeCVWithAI } from "../../ai/analyzeCVWithAI.js";

dotenv.config();

// ---- MongoDB Setup ----
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;
let candidatesCollection;
let filteredCollection;

async function connectDB() {
  await client.connect();
  db = client.db("hiring-db");
  candidatesCollection = db.collection("candidates"); // 🔍 Input collection
  filteredCollection = db.collection("filtered"); // 💾 Output collection
  console.log("✅ Connected to MongoDB");
}

// ---- Proto Setup ----
const PROTO_PATH = path.join(process.cwd(), "proto", "filtering.proto");
const packageDef = protoLoader.loadSync(PROTO_PATH);
const filteringProto = grpc.loadPackageDefinition(packageDef).filtering;

// ---- FilterCandidates RPC Method ----
async function FilterCandidates(call, callback) {
  const { minExperience, maxExperience, position } = call.request;
  console.log("📥 Filtering candidates...", {
    minExperience,
    maxExperience,
    position,
  });

  try {
    await filteredCollection.deleteMany({});
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
          await filteredCollection.insertOne(c);
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
  const { id } = call.request;

  try {
    const objectId = new ObjectId(id);

    const candidate = await filteredCollection.findOne({ _id: objectId });
    const result = await filteredCollection.deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      return callback(null, {
        message: `Candidate with ID ${id} not found in filtered collection.`,
        id: id,
      });
    }

    const name = candidate?.name || "(unknown)";
    console.log(`🗑️ Deleted candidate ${name} from filtered collection.`);

    callback(null, {
      message: `Candidate ${name} deleted successfully.`,
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
