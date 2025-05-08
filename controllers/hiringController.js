import { getGrpcClient } from "../utils/getGrpcClient.js";

// 🔁 Add candidate (HiringService)
export const addCandidate = async (req, res) => {
  console.log("[client:hiring] 🟡 Starting to add a candidate...");

  try {
    const client = await getGrpcClient(
      "HiringService",
      "hiring.proto",
      "hiring",
      "HiringService"
    );
    if (!client) {
      console.error("[client:hiring] ❌ HiringService client is not available");
      return res.status(500).json({ message: "HiringService not available" });
    }

    const { name, email, position, experience } = req.body;
    const pathCV = req.file?.path || "";

    console.log("[client:hiring] 🟡 Received data to add candidate:", {
      name,
      email,
      position,
      experience: parseInt(experience),
      pathCV,
    });

    //  gRPC
    client.AddCandidate(
      {
        name,
        email,
        position,
        experience: parseInt(experience),
        pathCV,
      },
      (err, response) => {
        if (err) {
          console.error("[client:hiring] ❌ gRPC AddCandidate error:", err);
          return res.status(500).json({ message: "Failed to add candidate" });
        }
        if (!response || !response.candidate) {
          console.warn("[client:hiring] ⚠️ gRPC returned no candidate.");
          return res.status(502).json({
            message: "No candidate data received from service.",
          });
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
      }
    );
  } catch (err) {
    console.error("[client:hiring] ❌ Unexpected error:", err.message);
    return res.status(500).json({ message: "Unexpected server error" });
  }
};

// 📥 Get candidates (HiringService)
export const getCandidates = async (req, res) => {
  console.log("[client:hiring] 🟡 Fetching all candidates...");

  try {
    const client = await getGrpcClient(
      "HiringService",
      "hiring.proto",
      "hiring",
      "HiringService"
    );

    if (!client) {
      console.error("[client:hiring] ❌ HiringService client unavailable");
      return res.status(500).json({ message: "HiringService not available" });
    }

    const call = client.GetAllCandidates({});
    const candidates = [];

    call.on("data", (candidate) => {
      candidates.push(candidate);
    });

    call.on("end", () => {
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
    });

    call.on("error", (err) => {
      console.error("[client:hiring] ❌ Stream error:", err.message);
      return res.status(500).json({
        message: "Failed to get candidates from gRPC service.",
        error: err.message,
      });
    });
  } catch (err) {
    console.error("[client:hiring] ❌ Unexpected error:", err.message);
    return res.status(500).json({ message: "Unexpected server error" });
  }
};

// ✏️ Edit candidate
export const updateCandidate = async (req, res) => {
  console.log("[client:hiring] 🟡 Starting to edit a candidate...");

  try {
    const client = await getGrpcClient(
      "HiringService",
      "hiring.proto",
      "hiring",
      "HiringService"
    );

    if (!client) {
      console.error("[client:hiring] ❌ HiringService client is not available");
      return res.status(500).json({ message: "HiringService not available" });
    }

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

    client.UpdateCandidate(payload, (err, response) => {
      if (err) {
        console.error(
          "[client:hiring] ❌ gRPC UpdateCandidate error:",
          err.message
        );
        return res.status(500).json({ message: "Failed to update candidate" });
      }

      if (!response) {
        console.warn(
          "[client:hiring] ⚠️ No response from gRPC UpdateCandidate."
        );
        return res
          .status(502)
          .json({ message: "No response from hiring service" });
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
          return res
            .status(500)
            .json({ message: "Unexpected response status" });
      }
    });
  } catch (err) {
    console.error("[client:hiring] ❌ Unexpected error:", err.message);
    return res.status(500).json({ message: "Unexpected server error" });
  }
};

// 🗑️ Delete candidate
export const deleteCandidate = async (req, res) => {
  console.log("[client:hiring] 🟡 Starting to delete candidate...");

  try {
    const client = await getGrpcClient(
      "HiringService",
      "hiring.proto",
      "hiring",
      "HiringService"
    );

    if (!client) {
      console.error("[client:hiring] ❌ HiringService client is not available");
      return res.status(500).json({ message: "HiringService not available" });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Candidate ID is required" });
    }

    console.log("[client:hiring] 🟡 Request to delete candidate with ID:", id);

    client.DeleteCandidate({ id }, (err, response) => {
      if (err) {
        console.error(
          "[client:hiring] ❌ gRPC DeleteCandidate error:",
          err.message
        );
      }

      console.log(
        "[client:hiring] 🟢 Candidate deleted successfully:",
        response
      );
      return res
        .status(200)
        .json({ message: response.message, id: response.id });
    });
  } catch (err) {
    console.error("[client:hiring] ❌ Unexpected error:", err);
    return res.status(500).json({ message: "Unexpected server error" });
  }
};
