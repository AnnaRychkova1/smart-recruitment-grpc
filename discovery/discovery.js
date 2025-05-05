// discovery.js

import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const registry = {};

// Registration services: POST /register
app.post("/register", (req, res) => {
  const { serviceName, host, port } = req.body;

  if (!serviceName || !host || !port) {
    return res.status(400).json({ error: "Missing fields in registration." });
  }

  // Check for the existence of the service in the registry
  if (registry[serviceName]) {
    return res.status(400).json({
      error: `${serviceName} is already registered at ${registry[serviceName].host}:${registry[serviceName].port}`,
    });
  }

  registry[serviceName] = { host, port };
  console.log(`✅ Registered: ${serviceName} at ${host}:${port}`);
  res.status(200).json({ message: "Service registered successfully" });
});

// Get service addresses GET /services/HiringService
app.get("/services/:serviceName", (req, res) => {
  const serviceInfo = registry[req.params.serviceName];
  if (!serviceInfo) {
    return res.status(404).json({ error: "Service not found" });
  }

  res.json(serviceInfo);
});

const PORT = process.env.DISCOVERY_PORT || 3001;
app.listen(PORT, () => {
  console.log(`📡 Discovery service running on http://localhost:${PORT}`);
});
