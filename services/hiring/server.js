import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import dotenv from "dotenv";
import { register } from "../../discovery/registry.js";

dotenv.config();

const PROTO_PATH = path.join(process.cwd(), "proto", "hiring.proto");
const packageDef = protoLoader.loadSync(PROTO_PATH);
const hiringProto = grpc.loadPackageDefinition(packageDef).hiring;

// Mock DB
const candidates = [];

function AddCandidate(call, callback) {
  const candidate = call.request;
  candidates.push(candidate);
  console.log("📥 New candidate added:", candidate.name);
  callback(null, { message: "Candidate successfully added!" });
}

function GetAllCandidates(call) {
  console.log("📤 Sending all candidates...");
  candidates.forEach((candidate) => {
    call.write(candidate);
  });
  call.end();
}

const server = new grpc.Server();
server.addService(hiringProto.HiringService.service, {
  AddCandidate,
  GetAllCandidates,
});

const PORT = process.env.HIRING_PORT || 50051;

server.bindAsync(
  `0.0.0.0:${PORT}`,
  grpc.ServerCredentials.createInsecure(),
  () => {
    server.start();
    console.log(`🚀 HiringService running on port ${PORT}`);
    register("HiringService", "localhost", PORT);
  }
);
