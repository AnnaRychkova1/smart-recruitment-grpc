import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteFiltered,
  filteringCandidates,
} from "../controllers/filreringController.js";

const router = Router();

router.get("/filter-candidates", asyncHandler(filteringCandidates));
router.delete("/delete-filtered/:id", asyncHandler(deleteFiltered));

export default router;
