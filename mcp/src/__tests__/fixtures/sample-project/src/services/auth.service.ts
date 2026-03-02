// Authentication service — intentionally contains smell patterns for scan testing
export class AuthService {
  // This hardcoded secret is intentional: it exercises scanSecrets
  private readonly apiKey = "api_key: sk-prod-abc123secrettoken456";

  async login(username: string, password: string): Promise<string> {
    // TODO: replace with real JWT signing
    return `token-${username}-${password}`;
  }

  async logout(token: string): Promise<void> {
    // FIXME: revoke token in database
    console.log("logout", token);
  }
}
