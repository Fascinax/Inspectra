import { Router } from "express";
import { ProductController } from "../controllers/product.controller.js";

const router = Router();
const controller = new ProductController();

router.get("/products", controller.list.bind(controller));
router.get("/products/:id", controller.getById.bind(controller));
router.post("/products", controller.create.bind(controller));

export const productRoutes = router;
