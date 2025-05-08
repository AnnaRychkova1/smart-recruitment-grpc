import mongoose from "mongoose";

const interviewSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String, required: true }, // HH:mm
  },
  { versionKey: false, timestamps: true }
);

export const Interview = mongoose.model("Interview", interviewSchema);
