import type { Request, Response } from "express";

export class UserController {
  async getUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    // TODO: add proper validation
    res.json({ id, name: "Alice" });
  }

  async createUser(req: Request, res: Response): Promise<void> {
    const body = req.body;
    // FIXME: sanitize input before saving
    res.status(201).json(body);
  }
}
