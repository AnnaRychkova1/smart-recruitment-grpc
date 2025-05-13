import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticateToken } from "../middleware/authenticate.js";
import {
  deleteInterview,
  scheduleInterviews,
  updateInterview,
  rescheduleInterviews,
} from "../controllers/interviewControllers.js";

const router = Router();

router.post(
  "/schedule-interviews",
  authenticateToken,
  asyncHandler(scheduleInterviews)
);

router.post(
  "/reschedule-interviews",
  authenticateToken,
  asyncHandler(rescheduleInterviews)
);
router.put(
  "/update-interview/:id",
  authenticateToken,
  asyncHandler(updateInterview)
);
router.delete(
  "/delete-interview/:id",
  authenticateToken,
  asyncHandler(deleteInterview)
);

export default router;
