import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

// Define the path to the .proto file
const PROTO_PATH = path.join(process.cwd(), "proto", "hiring.proto");

// Load and parse the protobuf definition
const packageDef = protoLoader.loadSync(PROTO_PATH);
const hiringProto = grpc.loadPackageDefinition(packageDef).hiring;

// In-memory array to store candidates
const candidates = [];

// Function to handle adding a new candidate
function AddCandidate(call, callback) {
  const candidate = call.request;
  candidates.push(candidate);
  console.log(`📥 Candidate ${candidate.name} successfully added!`); // Log candidate addition
  callback(null, {
    message: `Candidate ${candidate.name} successfully added!`, // Send confirmation response
  });
}

// Function to handle retrieving all candidates
function GetAllCandidates(call) {
  console.log("📤 Sending all candidates..."); // Log when sending candidate data
  candidates.forEach((candidate) => {
    call.write(candidate); // Stream each candidate to the client
  });
  call.end(); // Close the stream after sending all candidates
}

// Function to handle updating an existing candidate
function UpdateCandidate(call, callback) {
  const updated = call.request;
  const index = candidates.findIndex((c) => c.id === updated.id);

  // Check if candidate exists
  if (index === -1) {
    callback(null, {
      message: `❌ Candidate with ID ${updated.id} not found.`, // Return error if not found
    });
    return;
  }

  // Update the candidate's information
  candidates[index] = updated;
  console.log(
    `✏️ Candidate ${updated.name} with ID ${updated.id} updated successfully.` // Log successful update
  );
  callback(null, {
    message: `Candidate ${updated.name} updated successfully.`, // Send success message to client
  });
}

// Function to handle deleting a candidate
function DeleteCandidate(call, callback) {
  const { id } = call.request;
  const index = candidates.findIndex((c) => String(c.id) === String(id)); // Find candidate by ID

  // Check if candidate exists
  if (index === -1) {
    callback(null, { message: `❌ Candidate with ID ${id} not found.` }); // Return error if not found
    return;
  }

  // Remove the candidate from the list
  const [removed] = candidates.splice(index, 1);
  console.log(
    `🗑️  Candidate ${removed.name} (ID: ${removed.id}) deleted successfully.` // Log successful deletion
  );
  callback(null, {
    message: `Candidate ${removed.name} with ID ${removed.id}  deleted successfully.`, // Send success message to client
  });
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
server.bindAsync(
  `0.0.0.0:${PORT}`,
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log(`🚀 HiringService running on port ${PORT}`); // Log server start

    // 📡 Register this service with the service discovery system
    fetch("http://localhost:3001/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceName: "HiringService", // The name of the service being registered
        host: HOST, // The host address of the service
        port: PORT, // The port the service is running on
      }),
    })
      .then((res) => {
        // Check if the response status is in the 2xx range (successful request)
        if (!res.ok) {
          // If the response is not successful, throw an error with the status text
          throw new Error(`Discovery registration failed: ${res.statusText}`);
        }
        return res.json(); // If successful, parse the response as JSON
      })
      .then((data) => {
        // Log the response from the discovery service (successful registration)
        console.log("📡 Registered with discovery:", data);
      })
      .catch((err) => {
        // Log any error that occurred during the registration process
        console.error("❌ Discovery registration failed:", err);
      });
  }
);
