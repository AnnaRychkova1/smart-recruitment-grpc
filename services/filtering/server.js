import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from "fs/promises";
import pdfParse from "pdf-parse";
import { analyzeCVWithAI } from "../../ai/analyzeCVWithAI.js";

dotenv.config();
let filtered = []; // Array to hold filtered candidates

// Define paths to the .proto files
const FILTERING_PROTO_PATH = path.join(
  process.cwd(),
  "proto",
  "filtering.proto"
);
const HIRING_PROTO_PATH = path.join(process.cwd(), "proto", "hiring.proto");

// Load the protobuf definitions
const filteringDef = protoLoader.loadSync(FILTERING_PROTO_PATH);
const hiringDef = protoLoader.loadSync(HIRING_PROTO_PATH);

// Load the gRPC service definitions
const filteringProto = grpc.loadPackageDefinition(filteringDef).filtering;
const hiringProto = grpc.loadPackageDefinition(hiringDef).hiring;

// Function to connect to the HiringService using Discovery
async function getHiringServiceClient() {
  const discoveryUrl = "http://localhost:3001/services/HiringService"; // Discovery service URL
  const res = await fetch(discoveryUrl);
  const { host, port } = await res.json(); // Extract host and port from discovery response

  // Return the HiringService client
  return new hiringProto.HiringService(
    `${host}:${port}`,
    grpc.credentials.createInsecure()
  );
}

// Function to filter candidates based on experience, position, and AI analysis of CVs
export async function FilterCandidates(call, callback) {
  const { minExperience, maxExperience, position } = call.request;
  console.log("📥 Filtering candidates...", {
    minExperience,
    maxExperience,
    position,
  });

  try {
    const hiringClient = await getHiringServiceClient(); // Get the HiringService client
    console.log("i call HiringService on FilteringService");
    const allCandidates = []; // Array to store all candidates fetched
    const seenCandidateIds = new Set(); // Set to track seen candidate IDs and avoid duplicates

    // Stream of all candidates from HiringService
    const stream = hiringClient.GetAllCandidates({});

    // Listen for incoming candidate data
    stream.on("data", (candidate) => {
      if (!seenCandidateIds.has(candidate.id)) {
        seenCandidateIds.add(candidate.id); // Add candidate ID to the set
        allCandidates.push(candidate); // Add candidate to the list
      }
    });

    // When all candidates are received, process them
    stream.on("end", async () => {
      for (const c of allCandidates) {
        // Check if candidate's experience matches the criteria
        const withinExperience =
          c.experience >= minExperience && c.experience <= maxExperience;

        // Check if candidate's position matches the requested one
        const matchesPosition =
          !position || c.position.toLowerCase() === position.toLowerCase();

        // If candidate doesn't match experience or position criteria, skip them
        if (!withinExperience || !matchesPosition) continue;

        // Skip candidates without a CV path
        if (!c.pathCV) {
          console.warn(`⚠️ No CV path provided for ${c.name}`);
          continue;
        }

        try {
          // Read and parse the CV file
          const cvPath = path.resolve(process.cwd(), c.pathCV);
          const fileBuffer = await fs.readFile(cvPath);
          const parsed = await pdfParse(fileBuffer);
          const cvText = parsed.text;

          // Analyze CV with AI
          const aiResult = await analyzeCVWithAI(cvText, position);

          // If the CV is relevant, add candidate to the filtered list
          if (aiResult.relevant) {
            filtered.push(c); // Store relevant candidate
          } else {
            console.log(`🧠 CV not relevant for: ${c.name}`);
          }
        } catch (cvErr) {
          // Log if there is an issue processing the CV
          console.warn(`⚠️ Failed to process CV for ${c.name}:`, cvErr.message);
        }
      }
      if (filtered.length === 0) {
        console.log("❌ No candidates found matching the criteria.");
      }
      // Log the number of candidates that passed AI filtering
      console.log(`✅ ${filtered.length} candidates passed AI filtering.`);

      // Send filtered candidates back to the client
      filtered.forEach((candidate) => {
        call.write(candidate); // Stream each filtered candidate to the client
      });

      filtered.length = 0;
      // End the stream after sending all filtered candidates
      call.end();
    });

    // Handle errors when fetching candidates from the HiringService
    stream.on("error", (err) => {
      console.error("❌ Error fetching candidates from HiringService", err);
      callback(err, null); // Return error to the client
    });

    filtered.length = 0; // Reset the filtered list for next request
  } catch (err) {
    console.error("❌ Failed to filter candidates", err);
    callback(err, null); // Return error to the client
  }
}

// Function to delete a candidate from the filtered list
export function DeleteCandidate(call, callback) {
  const { id } = call.request;

  // Find the candidate by ID in the filtered list
  const index = filtered.findIndex((c) => String(c.id) === String(id));

  // If the candidate is not found, return an error message
  if (index === -1) {
    callback(null, { message: `❌ Candidate with ID ${id} not found.` });
    return;
  }

  // Remove the candidate from the filtered list
  const [removed] = filtered.splice(index, 1);
  console.log(
    `🗑️  Candidate ${removed.name} (ID: ${id}) deleted successfully.`
  );

  // Return success message with the name of the deleted candidate
  callback(null, {
    message: `Candidate ${removed.name} deleted successfully.`,
  });
}

// Create a new gRPC server instance
const server = new grpc.Server();

// Add the FilteringService with its methods to the server
server.addService(filteringProto.FilteringService.service, {
  FilterCandidates,
  DeleteCandidate,
});

// Define the port and host for the server
const PORT = process.env.FILTERING_PORT || 50052; // Default to port 50052 if not set
const HOST = "localhost";

// Bind the server to the specified address and port
server.bindAsync(
  `0.0.0.0:${PORT}`,
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log(`🚀 FilteringService running on port ${PORT}`); // Log server start

    // 📡 Register this service with the service discovery system
    fetch("http://localhost:3001/register", {
      method: "POST", // Use POST method to register the service
      headers: { "Content-Type": "application/json" }, // Specify the request content type
      body: JSON.stringify({
        serviceName: "FilteringService", // The name of the service being registered
        host: HOST, // The host address where the service is running
        port: PORT, // The port where the service is available
      }),
    })
      .then((res) => {
        // Check if the response status is within the 2xx range (successful)
        if (!res.ok) {
          // If the response is not successful, throw an error with status text
          throw new Error(`Discovery registration failed: ${res.statusText}`);
        }
        return res.json(); // Parse the response body as JSON if successful
      })
      .then((data) => {
        // Log the successful registration information from the discovery service
        console.log("📡 Registered with discovery:", data);
      })
      .catch((err) => {
        // Log any error that occurs during the registration process
        console.error("❌ Discovery registration failed:", err);
      });
  }
);
