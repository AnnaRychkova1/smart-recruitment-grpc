import { getGrpcClient } from "../utils/getGrpcClient.js";

// 📤 Filtering (FilteringService)
export const filteringCandidates = async (req, res) => {
  console.log("[client:filtering] 🟡 Starting to filter candidates...");

  try {
    const client = await getGrpcClient(
      "FilteringService",
      "filtering.proto",
      "filtering",
      "FilteringService"
    );

    if (!client) {
      console.error(
        "[client:filtering] ❌ FilteringService client is not available"
      );
      return res
        .status(500)
        .json({ message: "FilteringService not available" });
    }

    // Parse and sanitize query parameters
    const {
      position = "", // default: any position
      minExperience: rawMinExp,
      maxExperience: rawMaxExp,
    } = req.query;

    const minExperience = isNaN(Number(rawMinExp)) ? 0 : Number(rawMinExp);
    const maxExperience = isNaN(Number(rawMaxExp))
      ? Infinity
      : Number(rawMaxExp);

    console.log("[client:filtering] 🟡 Received filter parameters:", {
      position,
      minExperience,
      maxExperience,
    });

    const filtered = [];

    const call = client.FilterCandidates({
      minExperience,
      maxExperience,
      position,
    });

    call.on("data", (candidate) => {
      console.log(
        "[client:filtering] 🟡 Matching candidate received:",
        candidate
      );
      filtered.push(candidate);
    });

    call.on("end", () => {
      console.log(
        "[client:filtering] 🟢 Filtering completed. Total matches:",
        filtered.length
      );
      res.json({ filtered });
    });

    call.on("error", (err) => {
      console.error("[client:filtering] ❌ Error filtering candidates:", err);
      res.status(500).json({ message: "Failed to filter candidates" });
    });
  } catch (err) {
    console.error("[client:filtering] ❌ Unexpected error:", err);
    return res.status(500).json({ message: "Unexpected server error" });
  }
};

// 🗑️ Delete filtered candidate
export const deleteFiltered = async (req, res) => {
  console.log("[client:filtering] 🟡 Starting to delete filtered candidate...");

  try {
    const client = await getGrpcClient(
      "FilteringService",
      "filtering.proto",
      "filtering",
      "FilteringService"
    );
    if (!client) {
      console.error(
        "[client:filtering] ❌ FilteringService client is not available"
      );
      return res
        .status(500)
        .json({ message: "FilteringService not available" });
    }

    const { id } = req.params;

    console.log(
      "[client:filtering] 🟡 Request to delete candidate with ID:",
      id
    );

    client.DeleteCandidate({ id }, (err, response) => {
      if (err) {
        console.error(
          "[client:filtering] ❌ gRPC DeleteCandidate error:",
          err.message
        );
        return res.status(500).json({ message: "Failed to delete candidate" });
      }

      console.log(
        "[client:filtering] 🟢 Candidate deleted successfully:",
        response
      );

      return res.json({
        message: response.message,
        id: response.id,
      });
    });
  } catch (err) {
    console.error("[client:filtering] ❌ Unexpected error:", err);
    return res.status(500).json({ message: "Unexpected server error" });
  }
};
