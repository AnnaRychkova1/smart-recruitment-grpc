import { getGrpcClientForService } from "../utils/getGrpcClientForService.js";

// 🔁 Add candidate (HiringService)
export const addCandidate = async (req, res) => {
  console.log("[client:hiring] 🟡 Starting to add a candidate...");

  const client = await getGrpcClientForService("HiringService");

  const { name, email, position, experience } = req.body;
  const pathCV = req.file?.path || "";

  console.log("[client:hiring] 🟡 Received data to add candidate:", {
    name,
    email,
    position,
    experience: parseInt(experience),
    pathCV,
  });

  // gRPC call wrapped in a Promise for proper async/await handling
  const response = await new Promise((resolve, reject) => {
    client.AddCandidate(
      {
        name,
        email,
        position,
        experience: parseInt(experience),
        pathCV,
      },
      (err, response) => {
        if (err) return reject(err);
        resolve(response);
      }
    );
  });

  if (!response || !response.candidate) {
    const error = new Error("No candidate data received from service.");
    error.statusCode = 502;
    throw error;
  }

  console.log(
    "[client:hiring] 🟢 Candidate added successfully:",
    response.candidate
  );

  return res.json({
    status: response.status,
    message: response.message,
    candidate: response.candidate,
  });
};

// 📥 Get candidates (HiringService)
export const getCandidates = async (req, res) => {
  console.log("[client:hiring] 🟡 Fetching all candidates...");

  const client = await getGrpcClientForService("HiringService");

  // gRPC stream wrapped in Promise
  const candidates = await new Promise((resolve, reject) => {
    const result = [];
    const call = client.GetAllCandidates({});

    call.on("data", (candidate) => result.push(candidate));
    call.on("end", () => resolve(result));
    call.on("error", (err) => reject(err));
  });

  console.log(
    "[client:hiring] ✅ Stream ended. Candidates received:",
    candidates.length
  );

  return res.status(200).json({
    message: candidates.length
      ? "Candidates fetched successfully."
      : "No candidates found.",
    candidates,
  });
};

// ✏️ Update candidate
export const updateCandidate = async (req, res) => {
  console.log("[client:hiring] 🟡 Starting to edit a candidate...");
  const client = await getGrpcClientForService("HiringService");
  const { name, email, position, experience, existingPathCV } = req.body;
  const pathCV = req.file?.path || existingPathCV || "";
  const _id = req.params.id;

  const payload = {
    _id,
    name,
    email,
    position,
    experience: parseInt(experience),
    pathCV,
  };

  console.log("[client:hiring] 🟡 Sending update payload:", payload);

  const response = await new Promise((resolve, reject) => {
    client.UpdateCandidate(payload, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });

  if (!response) {
    const error = new Error("No response from hiring service");
    error.statusCode = 502;
    throw error;
  }

  console.log("[client:hiring] 🟢 UpdateCandidate response:", response);

  // Map gRPC status to HTTP status
  switch (response.status) {
    case 400:
      return res.status(400).json({ message: response.message });
    case 404:
      return res.status(404).json({ message: response.message });
    case 200:
      return res.status(200).json({
        message: response.message,
        candidate: response.candidate,
      });
    default:
      return res.status(500).json({ message: "Unexpected response status" });
  }
};

// 🗑️ Delete candidate
export const deleteCandidate = async (req, res) => {
  console.log("[client:hiring] 🟡 Starting to delete candidate...");

  const client = await getGrpcClientForService("HiringService");

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Candidate ID is required" });
  }

  console.log("[client:hiring] 🟡 Request to delete candidate with ID:", id);

  const response = await new Promise((resolve, reject) => {
    client.DeleteCandidate({ id }, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });

  if (!response || !response.id) {
    const error = new Error("No response from hiring service");
    error.statusCode = 502;
    throw error;
  }

  console.log("[client:hiring] 🟢 Candidate deleted successfully:", response);

  return res.status(200).json({ message: response.message, id: response.id });
};
