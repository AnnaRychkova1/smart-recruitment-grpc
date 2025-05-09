// app.js
import express from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";

import mainRoutes from "../routes/mainRoutes.js";
import hiringRoutes from "../routes/hiringRoutes.js";
import filteringRoutes from "../routes/filteringRoutes.js";
import interviewRoutes from "../routes/interviewRoutes.js";
import authRoutes from "../routes/authRoutes.js";

import { errorHandler } from "../middlware/errorHandler.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "gui", "views"));
app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/", mainRoutes);
app.use("/", hiringRoutes);
app.use("/", filteringRoutes);
app.use("/", interviewRoutes);
app.use("/", authRoutes);

app.use(errorHandler);

const PORT = process.env.CLIENT_PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Client GUI running on http://localhost:${PORT}`);
});

app.js;
