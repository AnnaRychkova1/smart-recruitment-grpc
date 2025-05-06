import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const registry = {};
const TTL = 60 * 1000; // Service TTL (60 seconds)

// Service registration or update
app.post("/register", (req, res) => {
  const { serviceName, host, port } = req.body;

  if (!serviceName || !host || !port) {
    return res.status(400).json({ error: "Missing fields in registration." });
  }

  const existing = registry[serviceName];

  // If the service already exists, update the timestamp (lastSeen)
  if (existing) {
    registry[serviceName] = {
      host,
      port,
      lastSeen: Date.now(), // Update the lastSeen time
    };
    console.log(`🔁 ${serviceName} already registered, updating lastSeen.`);
    return res.status(200).json({ message: "Service updated successfully" });
  }

  // If the service is new, register it
  registry[serviceName] = {
    host,
    port,
    lastSeen: Date.now(),
  };

  console.log(`✅ Registered: ${serviceName} at ${host}:${port}`);
  res.status(201).json({ message: "Service registered successfully" });
});

// Get service information
app.get("/services/:serviceName", (req, res) => {
  const serviceInfo = registry[req.params.serviceName];
  if (!serviceInfo) {
    return res.status(404).json({ error: "Service not found" });
  }

  res.json(serviceInfo);
});

// Automatic removal of inactive services
setInterval(() => {
  const now = Date.now();
  for (const [name, service] of Object.entries(registry)) {
    if (now - service.lastSeen > TTL) {
      delete registry[name];
      console.log(`🗑️ Auto-removed inactive service: ${name}`);
    }
  }
}, 2 * 60 * 60 * 1000); // Check every 2 hours (2 * 60 * 60 * 1000 ms)

const PORT = process.env.DISCOVERY_PORT || 3001;
app.listen(PORT, () => {
  console.log(`📡 Discovery service running on http://localhost:${PORT}`);
});
