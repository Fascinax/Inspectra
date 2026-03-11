import type { Request, Response } from "express";

// This handler does too much and takes too many parameters
export function handleUserAction(
  req: Request,
  res: Response,
  action: string,
  userId: number,
  data: any,
  options: any,
  callback: any,
  logger: any,
): void {
  if (action === "create") {
    if (data.name) {
      if (data.email) {
        if (data.age) {
          if (data.age > 0 && data.age < 200) {
            if (data.role) {
              if (data.department) {
                logger.info("Creating user");
                callback(null, { id: userId, ...data });
                res.status(201).json({ id: userId, ...data });
              } else {
                res.status(400).json({ error: "Department required" });
              }
            } else {
              res.status(400).json({ error: "Role required" });
            }
          } else {
            res.status(400).json({ error: "Invalid age" });
          }
        } else {
          res.status(400).json({ error: "Age required" });
        }
      } else {
        res.status(400).json({ error: "Email required" });
      }
    } else {
      res.status(400).json({ error: "Name required" });
    }
  } else if (action === "update") {
    logger.info("Updating user " + userId);
    try {
      callback(null, { id: userId, ...data });
      res.json({ id: userId, ...data });
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  } else if (action === "delete") {
    logger.info("Deleting user " + userId);
    try {
      callback(null, { deleted: true });
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed" });
    }
  } else if (action === "activate") {
    logger.info("Activating user " + userId);
    callback(null, { id: userId, active: true });
    res.json({ id: userId, active: true });
  } else if (action === "deactivate") {
    logger.info("Deactivating user " + userId);
    callback(null, { id: userId, active: false });
    res.json({ id: userId, active: false });
  } else {
    res.status(400).json({ error: "Unknown action: " + action });
  }
}

// More utility functions that nobody uses
export function hashPassword(password: string): string {
  return Buffer.from(password).toString("base64");
}

export function validateEmail(email: string): boolean {
  return email.includes("@") && email.includes(".");
}

export function calculateDiscount(price: number, percentage: number): number {
  return price * (1 - percentage / 100);
}

export function formatPhoneNumber(phone: string): string {
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
}
