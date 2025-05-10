import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import fetch from "node-fetch";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../../models/User.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB (AuthService)");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
};

// Load proto
const PROTO_PATH = path.join(process.cwd(), "proto", "auth.proto");
const packageDef = protoLoader.loadSync(PROTO_PATH);
const authProto = grpc.loadPackageDefinition(packageDef).auth;

// gRPC Handlers

function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
}

// Signup
async function SignUp(call, callback) {
  const { name, email, password } = call.request;

  if (!name || !email || !password) {
    console.error("❌ Missing fields in SignUp request");
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: "Name, email, and password are required",
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return callback({
        code: grpc.status.ALREADY_EXISTS,
        message: "User with this email already exists",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();
    const token = generateToken({ name, email });

    console.log("✅ User created successfully:", newUser);

    callback(null, { name: newUser.name, token });
  } catch (err) {
    console.error("❌ SignUp error:", err.message);
    callback({
      code: grpc.status.INTERNAL,
      message: "Server error during signup",
    });
  }
}

// Signin
async function SignIn(call, callback) {
  const { email, password } = call.request;

  console.log("📋 SignIn request:", { email });

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ User not found with email ${email}`);
      return callback({
        code: grpc.status.NOT_FOUND,
        message: "User not found",
      });
    }

    console.log("🔐 Comparing password...");
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.log("❌ Invalid credentials for user:", email);
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: "Invalid credentials",
      });
    }

    const token = generateToken({ name: user.name, email });

    console.log("✅ Credentials are valid");

    callback(null, { name: user.name, token });
  } catch (err) {
    console.error("❌ SignIn error:", err.message);
    callback({
      code: grpc.status.INTERNAL,
      message: "Server error during signin",
    });
  }
}

// gRPC Server Setup

const server = new grpc.Server();
server.addService(authProto.AuthService.service, {
  SignUp,
  SignIn,
});

const PORT = process.env.AUTH_PORT || 50054;
const HOST = "localhost";

connectDB().then(() => {
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    () => {
      console.log(`🚀 AuthService running on port ${PORT}`);

      // Register with service discovery
      fetch("http://localhost:3001/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: "AuthService",
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
});
