import { Metadata } from "@grpc/grpc-js";
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

  const metadata = new Metadata();
  metadata.add("authorization", `${req.headers.authorization}`);

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
      metadata,
      (err, response) => {
        if (err) return reject(err); // Reject if there is an error from the gRPC call
        resolve(response); // Resolve with the response from gRPC
      }
    );
  });

  // Log the raw response for debugging purposes
  console.log("gRPC response:", response);

  // Handle the response based on status
  if (!response || !response.candidate || !response.message) {
    console.log(
      "[client:hiring] ❌ Error adding candidate:",
      response?.message
    );
    return res.status(400).json({
      message:
        response?.message || "Error occurred while adding the candidate.",
    });
  }

  return res.status(200).json({
    message: response.message,
    candidate: response.candidate,
  });
};

// 🔁 Add many candidates (HiringService)
export const addManyCandidates = async (req, res) => {
  console.log("[client:hiring] 🟡 Starting to add multiple candidates...");

  const client = await getGrpcClientForService("HiringService");

  const files = req.files;
  if (!files?.length) {
    return res.status(400).json({ message: "No CV files provided." });
  }

  const pathsCV = files.map((file) => file.path);
  console.log("[client:hiring] 🟡 Received file paths:", pathsCV);

  if (!Array.isArray(pathsCV) || pathsCV.length === 0) {
    return res
      .status(400)
      .json({ message: "pathsCV must be a non-empty array" });
  }

  // gRPC metadata with token
  const metadata = new Metadata();
  metadata.add("authorization", `${req.headers.authorization}`);

  try {
    const response = await new Promise((resolve, reject) => {
      const stream = client.AddManyCandidates(metadata, (err, response) => {
        if (err) return reject(err);
        resolve(response);
      });

      for (const singlePath of pathsCV) {
        console.log(`[client:hiring] 📤 Sending pathCV: ${singlePath}`);
        stream.write({ pathCV: singlePath });
      }

      stream.end();
    });

    console.log("[client:hiring] 🟢 Stream completed:", response);

    return res.status(200).json({
      addedCount: response.addedCount,
      message: response.message,
    });
  } catch (err) {
    console.error(
      "[client:hiring] 🔴 Failed to add candidates via stream:",
      err
    );
    return res
      .status(500)
      .json({ message: "Failed to add candidates via stream." });
  }
};

// 📥 Get candidates (HiringService)
export const getCandidates = async (req, res) => {
  console.log("[client:hiring] 🟡 Fetching all candidates...");

  const client = await getGrpcClientForService("HiringService");

  const metadata = new Metadata();
  metadata.add("authorization", `${req.headers.authorization}`);

  // gRPC stream wrapped in Promise
  const candidates = await new Promise((resolve, reject) => {
    const result = [];
    const call = client.GetAllCandidates({}, metadata);

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

  const metadata = new Metadata();
  metadata.add("authorization", `${req.headers.authorization}`);

  const response = await new Promise((resolve, reject) => {
    client.UpdateCandidate(payload, metadata, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });

  console.log("[client:hiring] 🟢 UpdateCandidate response:", response);

  if (!response || !response.candidate || !response.message) {
    return res.status(400).json({
      message:
        response?.message || "Error occurred while updating the candidate.",
    });
  }
  return res.status(200).json({
    message: response.message,
    candidate: response.candidate,
  });
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

  const metadata = new Metadata();
  metadata.add("authorization", `${req.headers.authorization}`);

  const response = await new Promise((resolve, reject) => {
    client.DeleteCandidate({ id }, metadata, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });

  if (!response || !response.id || !response.message) {
    return res.status(400).json({
      message: response?.message || "Candidate not deleted or not found.",
    });
  }

  console.log("[client:hiring] 🟢 Candidate deleted successfully:", response);

  return res.status(200).json({ message: response.message, id: response.id });
};
