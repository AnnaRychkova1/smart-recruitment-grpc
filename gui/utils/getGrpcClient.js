import express from "express";
import fetch from "node-fetch";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
const grpcClients = {};
const loadedProtos = {};

const app = express();
app.use(express.json());

export async function getGrpcClient(
  serviceName,
  protoFile,
  packageName,
  grpcServiceName,
  retries = 3,
  delay = 500
) {
  if (grpcClients[serviceName]) {
    return grpcClients[serviceName];
  }

  console.log(`🔍 Looking up "${serviceName}" from discovery...`);

  async function fetchServiceInfo() {
    try {
      const res = await fetch(`http://localhost:3001/services/${serviceName}`, {
        timeout: 2000,
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error("❌ Failed to fetch service info:", err);
      return null;
    }
  }

  let serviceInfo = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`🔄 Retry attempt ${attempt} of ${retries}`);
    serviceInfo = await fetchServiceInfo();
    if (serviceInfo) break;
    if (attempt < retries) {
      console.log(`⏳ Waiting ${delay}ms before next attempt...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  if (!serviceInfo) {
    console.error(
      `❌ Service "${serviceName}" not found in registry after ${retries} attempts.`
    );
    return null;
  }

  const { host, port } = serviceInfo;
  if (!host || !port) {
    console.warn(`⚠️ Invalid service info for "${serviceName}".`);
    return null;
  }

  const cacheKey = `${protoFile}-${packageName}`;
  let proto;

  if (loadedProtos[cacheKey]) {
    proto = loadedProtos[cacheKey];
  } else {
    const protoPath = path.join(process.cwd(), "proto", protoFile);
    const packageDef = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    proto = grpc.loadPackageDefinition(packageDef);
    loadedProtos[cacheKey] = proto;
  }

  const Service = proto[packageName]?.[grpcServiceName];
  if (!Service) {
    console.error(
      `❌ gRPC service "${grpcServiceName}" not found in package "${packageName}".`
    );
    return null;
  }

  const client = new Service(
    `${host}:${port}`,
    grpc.credentials.createInsecure()
  );
  grpcClients[serviceName] = client;

  console.log(`✅ Connected to "${serviceName}" at ${host}:${port}`);
  return client;
}
