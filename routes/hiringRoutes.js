import { Router } from "express";
import { upload } from "../middlware/uploadMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {
  addCandidate,
  getCandidates,
  updateCandidate,
  deleteCandidate,
} from "../controllers/hiringController.js";

const router = Router();

router.post(
  "/add-candidate",
  upload.single("pathCV"),
  asyncHandler(addCandidate)
);
router.get("/get-candidates", asyncHandler(getCandidates));
router.put(
  "/update-candidate/:id",
  upload.single("pathCV"),
  asyncHandler(updateCandidate)
);
router.delete("/delete-candidate/:id", asyncHandler(deleteCandidate));

export default router;
