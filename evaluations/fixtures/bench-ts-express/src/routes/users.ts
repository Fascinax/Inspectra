import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";

const router = Router();
const controller = new UserController();

// TODO: add authentication middleware
router.get("/getUser/:id", controller.getById.bind(controller));
router.post("/createUser", controller.create.bind(controller));
router.put("/updateUser/:id", controller.update.bind(controller));
router.delete("/deleteUser/:id", controller.remove.bind(controller));

export const userRoutes = router;
