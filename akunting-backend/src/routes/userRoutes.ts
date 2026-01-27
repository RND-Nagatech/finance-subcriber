import { Router } from "express";
import { getUsers, updateUser, deleteUser } from "../controllers/userController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

// All user management routes require authentication
router.use(authenticate);

router.get("/", getUsers);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;