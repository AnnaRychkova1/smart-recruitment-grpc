import { Router } from "express";
import {
  deleteInterview,
  scheduleInterviews,
  updateInterview,
} from "../controllers/interviewControllers.js";

const router = Router();

router.post("/schedule-interviews", scheduleInterviews);

router.put("/update-interview/:id", updateInterview);

router.delete("/delete-interview/:id", deleteInterview);

export default router;
