import { Router } from "express";
import {
  uploadSingle,
  uploadMultiple,
} from "../middleware/uploadMiddleware.js";
import { authenticateToken } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {
  addCandidate,
  getCandidates,
  updateCandidate,
  deleteCandidate,
  addManyCandidates,
} from "../controllers/hiringController.js";

const router = Router();

router.post(
  "/add-candidate",
  authenticateToken,
  uploadSingle.single("pathCV"),
  asyncHandler(addCandidate)
);

router.post(
  "/bulk-add-candidates",
  authenticateToken,
  uploadMultiple.array("pathCV", 10),
  asyncHandler(addManyCandidates)
);
router.get("/get-candidates", authenticateToken, asyncHandler(getCandidates));
router.put(
  "/update-candidate/:id",
  uploadSingle.single("pathCV"),
  authenticateToken,
  asyncHandler(updateCandidate)
);
router.delete(
  "/delete-candidate/:id",
  authenticateToken,
  asyncHandler(deleteCandidate)
);

export default router;
