import { getGrpcClient } from "./getGrpcClient.js";

const protoFiles = {
  HiringService: "hiring.proto",
  InterviewService: "interview.proto",
  FilteringService: "filtering.proto",
  AuthService: "auth.proto",
};

export const getGrpcClientForService = async (serviceName) => {
  if (!protoFiles[serviceName]) {
    throw new Error(`No .proto file defined for service: ${serviceName}`);
  }

  const protoPath = protoFiles[serviceName];
  const serviceKey = serviceName.split("Service")[0].toLowerCase();

  const client = await getGrpcClient(
    serviceName,
    protoPath,
    serviceKey,
    serviceName
  );

  if (!client) {
    const error = new Error(`${serviceName} unavailable`);
    error.statusCode = 500;
    throw error;
  }

  return client;
};
