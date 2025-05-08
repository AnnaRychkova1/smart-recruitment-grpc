import { getGrpcClientForService } from "../utils/getGrpcClientForService.js";

// 📤 Filtering (FilteringService)
export const filteringCandidates = async (req, res) => {
  console.log("[client:filtering] 🟡 Starting to filter candidates...");

  const client = await getGrpcClientForService("FilteringService");

  const {
    position = "",
    minExperience: rawMinExp,
    maxExperience: rawMaxExp,
  } = req.query;

  const minExperience = isNaN(Number(rawMinExp)) ? 0 : Number(rawMinExp);
  const maxExperience = isNaN(Number(rawMaxExp)) ? Infinity : Number(rawMaxExp);

  console.log("[client:filtering] 🟡 Received filter parameters:", {
    position,
    minExperience,
    maxExperience,
  });

  const filtered = await new Promise((resolve, reject) => {
    const result = [];
    const call = client.FilterCandidates({
      position,
      minExperience,
      maxExperience,
    });

    call.on("data", (candidate) => {
      console.log(
        "[client:filtering] 🟡 Matching candidate received:",
        candidate
      );
      result.push(candidate);
    });

    call.on("end", () => resolve(result));
    call.on("error", (err) => reject(err));
  });

  console.log(
    "[client:filtering] 🟢 Filtering completed. Total matches:",
    filtered.length
  );

  return res.status(200).json({
    message: filtered.length
      ? "Filtered candidates received."
      : "No candidates matched filters.",
    filtered,
  });
};

// 🗑️ Delete filtered candidate
export const deleteFiltered = async (req, res) => {
  console.log("[client:filtering] 🟡 Starting to delete filtered candidate...");

  const client = await getGrpcClientForService("FilteringService");

  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Candidate ID is required" });
  }

  console.log("[client:filtering] 🟡 Request to delete candidate with ID:", id);

  const response = await new Promise((resolve, reject) => {
    client.DeleteCandidate({ id }, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });

  if (!response || !response.id) {
    const error = new Error("No response from filtering service");
    error.statusCode = 502;
    throw error;
  }

  console.log(
    "[client:filtering] 🟢 Candidate deleted successfully:",
    response
  );

  return res.status(200).json({
    message: response.message,
    id: response.id,
  });
};
