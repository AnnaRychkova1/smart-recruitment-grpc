import { Router } from "express";
import {
  deleteFiltered,
  filteringCandidates,
} from "../controllers/filreringController.js";

const router = Router();

router.get("/filter-candidates", filteringCandidates);

router.delete("/delete-filtered/:id", deleteFiltered);

export default router;
