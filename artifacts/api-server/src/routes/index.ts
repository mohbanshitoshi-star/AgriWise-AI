import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agriwiseRouter from "./agriwise";
import geminiRouter from "./gemini";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agriwiseRouter);
router.use(geminiRouter);

export default router;
