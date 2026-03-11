export function formatCurrency(amount: number): string {
  return `$${(amount / 100).toFixed(2)}`;
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + "..." : str;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function debounce(fn: (...args: unknown[]) => void, ms: number): (...args: unknown[]) => void {
  let timer: NodeJS.Timeout;
  return (...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function retryWithBackoff(retries: number): number[] {
  const delays: number[] = [];
  for (let i = 0; i < retries; i++) {
    delays.push(1000 * Math.pow(2, i));
  }
  return delays;
}
