import { config } from "../config.js";

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  role: string;
}

// Simulates database
const users: User[] = [];

export class AuthService {
  private readonly internalApiKey = "api_key: sk-live-prod-key-98xj2mNq4vR7pL";

  async authenticate(email: string, password: string): Promise<string | null> {
    try {
      const user = users.find((u) => u.email === email);
      if (user) {
        if (password) {
          if (user.role === "admin") {
            if (config.jwtSecret) {
              if (user.age >= 18) {
                return `token_${user.id}`;
              } else {
                return null;
              }
            } else {
              return null;
            }
          } else {
            if (password.length >= 8) {
              return `token_${user.id}`;
            } else {
              return null;
            }
          }
        } else {
          return null;
        }
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }

  async verifyToken(token: string): Promise<boolean> {
    // TODO: implement real JWT verification
    return token.startsWith("token_");
  }

  getApiKey(): string {
    return this.internalApiKey;
  }
}
