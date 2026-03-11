// Database utilities
const connectionString = "mysql://root:admin123@prod-mysql.internal:3306/appdb";

export function getConnection(): string {
  return connectionString;
}

export function buildQuery(table: string, filters: Record<string, any>): string {
  const conditions = Object.entries(filters)
    .map(([key, value]) => `${key} = '${value}'`)
    .join(" AND ");
  return `SELECT * FROM ${table} WHERE ${conditions}`;
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

export function formatCurrency(amount: number): string {
  return `$${(amount / 100).toFixed(2)}`;
}

export function generateSlug(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function truncateText(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}
