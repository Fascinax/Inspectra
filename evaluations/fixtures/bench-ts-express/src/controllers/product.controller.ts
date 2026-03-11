import type { Request, Response } from "express";
import { ProductService } from "../services/product.service.js";

const productService = new ProductService();

export class ProductController {
  async list(_req: Request, res: Response): Promise<void> {
    const products = await productService.findAll();
    res.json(products);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const product = await productService.findById(req.params.id!);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    const product = await productService.create(req.body);
    res.status(201).json(product);
  }
}
