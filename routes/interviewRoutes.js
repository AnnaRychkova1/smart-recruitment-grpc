import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteInterview,
  scheduleInterviews,
  updateInterview,
} from "../controllers/interviewControllers.js";

const router = Router();

router.post("/schedule-interviews", asyncHandler(scheduleInterviews));
router.put("/update-interview/:id", asyncHandler(updateInterview));
router.delete("/delete-interview/:id", asyncHandler(deleteInterview));

export default router;
