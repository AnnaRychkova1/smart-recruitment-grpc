import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticateToken } from "../middleware/authenticate.js";
import {
  deleteInterview,
  scheduleInterviews,
  updateInterview,
} from "../controllers/interviewControllers.js";

const router = Router();

router.post(
  "/schedule-interviews",
  authenticateToken,
  asyncHandler(scheduleInterviews)
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
