import mongoose from "mongoose";

const filteredSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    position: { type: String, required: true },
    experience: { type: Number, required: true },
    pathCV: { type: String, required: true },
  },
  { versionKey: false, timestamps: true }
);

export const Filtered = mongoose.model("Filtered", filteredSchema);
