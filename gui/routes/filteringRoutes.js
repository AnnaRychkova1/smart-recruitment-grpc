import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticateToken } from "../middleware/authenticate.js";
import {
  deleteFiltered,
  filteringCandidates,
} from "../controllers/filreringController.js";

const router = Router();

router.get(
  "/filter-candidates",
  authenticateToken,
  asyncHandler(filteringCandidates)
);
router.delete(
  "/delete-filtered/:id",
  authenticateToken,
  asyncHandler(deleteFiltered)
);

export default router;
