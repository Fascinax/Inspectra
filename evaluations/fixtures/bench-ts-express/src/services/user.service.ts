interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  role: string;
}

const users: User[] = [];
let nextId = 1;

export class UserService {
  async findById(id: string): Promise<User | undefined> {
    return users.find((u) => u.id === id);
  }

  async findAll(): Promise<User[]> {
    return [...users];
  }

  async create(data: Omit<User, "id">): Promise<User> {
    const user = { ...data, id: String(nextId++) };
    users.push(user);
    return user;
  }

  async update(id: string, data: Partial<User>): Promise<User | undefined> {
    const idx = users.findIndex((u) => u.id === id);
    if (idx < 0) return undefined;
    users[idx] = { ...users[idx]!, ...data };
    return users[idx];
  }

  async delete(id: string): Promise<boolean> {
    const idx = users.findIndex((u) => u.id === id);
    if (idx < 0) return false;
    users.splice(idx, 1);
    return true;
  }
}
