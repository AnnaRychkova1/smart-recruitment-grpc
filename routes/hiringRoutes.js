import { Router } from "express";
import { upload } from "../middlware/uploadMiddleware.js";
import {
  addCandidate,
  getCandidates,
  updateCandidate,
  deleteCandidate,
} from "../controllers/hiringController.js";

const router = Router();

router.post("/add-candidate", upload.single("pathCV"), addCandidate);
router.get("/get-candidates", getCandidates);
router.put("/update-candidate/:id", upload.single("pathCV"), updateCandidate);
router.delete("/delete-candidate/:id", deleteCandidate);

export default router;
