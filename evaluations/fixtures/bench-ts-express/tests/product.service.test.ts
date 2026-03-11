import { describe, it, expect } from "vitest";
import { ProductService } from "../src/services/product.service.js";

describe("ProductService", () => {
  it("should create a product", async () => {
    const service = new ProductService();
    const product = await service.create({ name: "Widget", price: 999 });
    expect(product.id).toBeDefined();
    expect(product.name).toBe("Widget");
  });

  it("should find product by id", async () => {
    const service = new ProductService();
    const created = await service.create({ name: "Gadget", price: 1999 });
    const found = await service.findById(created.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("Gadget");
  });
});
