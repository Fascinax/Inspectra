interface Product {
  id: string;
  name: string;
  price: number;
}

const products: Product[] = [];
let nextId = 1;

export class ProductService {
  async findAll(): Promise<Product[]> {
    return [...products];
  }

  async findById(id: string): Promise<Product | undefined> {
    return products.find((p) => p.id === id);
  }

  async create(data: Omit<Product, "id">): Promise<Product> {
    const product = { ...data, id: String(nextId++) };
    products.push(product);
    return product;
  }
}
