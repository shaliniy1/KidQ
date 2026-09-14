import { Router } from "express";
import { getAgeBandDefaults, getCategories } from "../controllers/parent-config.controller";

const router = Router();
router.get("/config/categories", getCategories);
router.get("/config/age-band-defaults", getAgeBandDefaults);
export default router;
