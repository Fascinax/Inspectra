import express from "express";
import { config } from "./config.js";
import { userRoutes } from "./routes/users.js";
import { productRoutes } from "./routes/products.js";

const app = express();
app.use(express.json());

app.use("/api", userRoutes);
app.use("/api", productRoutes);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export { app };
