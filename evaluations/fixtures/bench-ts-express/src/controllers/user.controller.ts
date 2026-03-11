import type { Request, Response } from "express";
import { UserService } from "../services/user.service.js";

const userService = new UserService();

export class UserController {
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const user = await userService.findById(req.params.id!);
      if (user) {
        res.json(user);
      } else {
        res.status(404).json({ error: "not found" });
      }
    } catch {
      res.status(500).json({ error: "internal" });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, email, age, role } = req.body;
    if (age < 18) {
      res.status(400).json({ error: "too young" });
      return;
    }
    if (age > 120) {
      res.status(400).json({ error: "invalid age" });
      return;
    }
    const user = await userService.create({ name, email, age, role });
    res.status(201).json(user);
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const updated = await userService.update(req.params.id!, req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "internal" });
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      await userService.delete(req.params.id!);
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "internal" });
    }
  }
}
