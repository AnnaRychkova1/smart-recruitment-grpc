import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    position: { type: String, required: true },
    experience: { type: Number, required: true },
    pathCV: { type: String, required: true },
  },
  { versionKey: false, timestamps: true }
);

export const Candidate = mongoose.model("Candidate", candidateSchema);
