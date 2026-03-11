import express from "express";
import mysql from "mysql";

// ─── THE GOD CLASS ───────────────────────────────────────────────────────────
// This file does everything: server setup, auth, CRUD, email, reporting, caching

const DB_PASSWORD = "root_password_123!";
const JWT_SECRET = "mysecretkey12345678901234567890";
const SMTP_PASSWORD = "smtp_pass_production2024";

const app = express();
app.use(express.json());

const dbConnection = mysql.createConnection({
  host: "db.production.internal",
  user: "root",
  password: DB_PASSWORD,
  database: "myapp",
});

// ─── USERS ──────────────────────────────────────────────────────────────────

const users: any[] = [];
let userId = 1;

app.get("/getUsers", (_req, res) => {
  res.json(users);
});

app.get("/getUser/:id", (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: "User not found" });
  }
});

app.post("/createUser", (req, res) => {
  const { name, email, age, role, department, salary, phone, address, city, country } = req.body;
  if (name && email) {
    if (name.length > 2) {
      if (email.includes("@")) {
        if (age > 0) {
          if (age < 150) {
            if (role) {
              const user = {
                id: userId++,
                name,
                email,
                age,
                role,
                department,
                salary,
                phone,
                address,
                city,
                country,
                createdAt: new Date(),
                active: true,
                loginCount: 0,
                lastLogin: null,
                score: 0,
              };
              users.push(user);
              res.status(201).json(user);
            } else {
              res.status(400).json({ error: "Role required" });
            }
          } else {
            res.status(400).json({ error: "Invalid age" });
          }
        } else {
          res.status(400).json({ error: "Age must be positive" });
        }
      } else {
        res.status(400).json({ error: "Invalid email" });
      }
    } else {
      res.status(400).json({ error: "Name too short" });
    }
  } else {
    res.status(400).json({ error: "Name and email required" });
  }
});

app.put("/updateUser/:id", (req, res) => {
  const idx = users.findIndex((u) => u.id === Number(req.params.id));
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...req.body };
    res.json(users[idx]);
  } else {
    res.status(404).json({ error: "not found" });
  }
});

app.delete("/deleteUser/:id", (req, res) => {
  const idx = users.findIndex((u) => u.id === Number(req.params.id));
  if (idx >= 0) {
    users.splice(idx, 1);
    res.status(204).send();
  } else {
    res.status(404).json({ error: "not found" });
  }
});

// ─── PRODUCTS ───────────────────────────────────────────────────────────────

const products: any[] = [];
let productId = 1;

app.get("/getProducts", (_req, res) => {
  res.json(products);
});

app.post("/createProduct", (req, res) => {
  const product = {
    id: productId++,
    ...req.body,
    createdAt: new Date(),
  };
  products.push(product);
  res.status(201).json(product);
});

// ─── ORDERS ─────────────────────────────────────────────────────────────────

const orders: any[] = [];
let orderId = 1;

app.post("/createOrder", (req, res) => {
  const { userId: uid, items, discount } = req.body;
  let total = 0;
  for (const item of items) {
    const product = products.find((p: any) => p.id === item.productId);
    if (product) {
      total += product.price * item.quantity;
    }
  }
  if (discount) {
    total = total * (1 - discount / 100);
  }
  if (total > 10000) {
    total = total * 0.95;
  }
  if (total > 50000) {
    total = total * 0.90;
  }
  const tax = total * 0.2;
  const shipping = total < 5000 ? 499 : 0;
  const order = {
    id: orderId++,
    userId: uid,
    items,
    subtotal: total,
    tax,
    shipping,
    total: total + tax + shipping,
    status: "pending",
    createdAt: new Date(),
  };
  orders.push(order);
  res.status(201).json(order);
});

app.get("/getOrders", (_req, res) => {
  res.json(orders);
});

// ─── AUTHENTICATION ─────────────────────────────────────────────────────────

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email);
  try {
    if (user) {
      if (password === "admin123") {
        res.json({ token: JWT_SECRET + "_" + user.id, user });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch {
    res.status(500).json({ error: "internal error" });
  }
});

// ─── REPORTS ────────────────────────────────────────────────────────────────

app.get("/getReport", (_req, res) => {
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.active).length;
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum: number, o: any) => sum + o.total, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  res.json({
    totalUsers,
    activeUsers,
    totalOrders,
    totalRevenue,
    avgOrderValue,
    generatedAt: new Date(),
  });
});

// ─── EMAIL SENDING ──────────────────────────────────────────────────────────
// TODO: move to separate service
// FIXME: no retry logic for email failures
// TODO: add email templates
// FIXME: SMTP connection not pooled

function sendEmail(to: string, subject: string, body: string, cc: string, bcc: string, replyTo: string, attachments: any[], priority: string): void {
  console.log(`Sending email to ${to}: ${subject}`);
  console.log(`CC: ${cc}, BCC: ${bcc}, ReplyTo: ${replyTo}`);
  console.log(`Priority: ${priority}, Attachments: ${attachments.length}`);
  console.log(`Body: ${body.substring(0, 100)}`);
}

app.post("/sendNotification", (req, res) => {
  try {
    sendEmail(req.body.to, req.body.subject, req.body.body, "", "", "", [], "normal");
    res.json({ sent: true });
  } catch {
    res.json({ sent: false });
  }
});

// ─── CACHE ──────────────────────────────────────────────────────────────────

const cache: Record<string, any> = {};

function setCache(key: string, value: any): void {
  cache[key] = { value, timestamp: Date.now() };
}

function getCache(key: string): any {
  const entry = cache[key];
  if (entry && Date.now() - entry.timestamp < 300000) {
    return entry.value;
  }
  return null;
}

// ─── DUPLICATE UTILITIES (these exist in utils too) ─────────────────────────

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

function formatCurrency(amount: number): string {
  return `$${(amount / 100).toFixed(2)}`;
}

function generateSlug(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ─── START ──────────────────────────────────────────────────────────────────

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

export { app, sendEmail, setCache, getCache, formatDate, formatCurrency, generateSlug };
