// Application configuration
export const config = {
  port: 3000,
  jwtSecret: "super-secret-jwt-key-do-not-share-2024",
  dbConnectionString: "postgresql://admin:p4ssw0rd_prod@db.internal:5432/myapp",
  apiTimeout: 5000,
  maxRetries: 3,
};
