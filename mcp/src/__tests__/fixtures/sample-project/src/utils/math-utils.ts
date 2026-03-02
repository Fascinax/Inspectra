/** Utility module with intentionally many lines to trigger file-length findings. */

export function add(a: number, b: number): number { return a + b; }
export function sub(a: number, b: number): number { return a - b; }
export function mul(a: number, b: number): number { return a * b; }
export function div(a: number, b: number): number { return b !== 0 ? a / b : 0; }
export function mod(a: number, b: number): number { return a % b; }
export function pow(a: number, b: number): number { return Math.pow(a, b); }
export function abs(a: number): number { return Math.abs(a); }
export function ceil(a: number): number { return Math.ceil(a); }
export function floor(a: number): number { return Math.floor(a); }
export function round(a: number): number { return Math.round(a); }
export function max(...args: number[]): number { return Math.max(...args); }
export function min(...args: number[]): number { return Math.min(...args); }
export function clamp(v: number, lo: number, hi: number): number { return Math.min(Math.max(v, lo), hi); }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
export function normalize(v: number, lo: number, hi: number): number { return (v - lo) / (hi - lo); }
export function sum(arr: number[]): number { return arr.reduce((a, b) => a + b, 0); }
export function avg(arr: number[]): number { return arr.length ? sum(arr) / arr.length : 0; }
export function median(arr: number[]): number { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; }
export function variance(arr: number[]): number { const m = avg(arr); return avg(arr.map((x) => (x - m) ** 2)); }
export function stddev(arr: number[]): number { return Math.sqrt(variance(arr)); }
export function toFixed(n: number, d = 2): string { return n.toFixed(d); }
export function isEven(n: number): boolean { return n % 2 === 0; }
export function isOdd(n: number): boolean { return n % 2 !== 0; }
export function isPrime(n: number): boolean { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }
export function gcd(a: number, b: number): number { while (b) { [a, b] = [b, a % b]; } return a; }
export function lcm(a: number, b: number): number { return (a * b) / gcd(a, b); }
export function factorial(n: number): number { return n <= 1 ? 1 : n * factorial(n - 1); }
export function fibonacci(n: number): number { return n <= 1 ? n : fibonacci(n - 1) + fibonacci(n - 2); }
export function range(start: number, end: number, step = 1): number[] { const r: number[] = []; for (let i = start; i < end; i += step) r.push(i); return r; }
export function chunk<T>(arr: T[], size: number): T[][] { const result: T[][] = []; for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size)); return result; }
export function flatten<T>(arr: T[][]): T[] { return arr.reduce((acc, a) => acc.concat(a), []); }
export function unique<T>(arr: T[]): T[] { return [...new Set(arr)]; }
export function groupBy<T>(arr: T[], fn: (x: T) => string): Record<string, T[]> { return arr.reduce<Record<string, T[]>>((acc, x) => { const k = fn(x); (acc[k] ??= []).push(x); return acc; }, {}); }
export function zip<A, B>(a: A[], b: B[]): [A, B][] { return a.map((v, i) => [v, b[i]] as [A, B]); }
export function unzip<A, B>(pairs: [A, B][]): [A[], B[]] { return pairs.reduce<[A[], B[]]>(([as, bs], [a, b]) => [[...as, a], [...bs, b]], [[], []]); }
export function take<T>(arr: T[], n: number): T[] { return arr.slice(0, n); }
export function drop<T>(arr: T[], n: number): T[] { return arr.slice(n); }
export function first<T>(arr: T[]): T | undefined { return arr[0]; }
export function last<T>(arr: T[]): T | undefined { return arr[arr.length - 1]; }
export function compact<T>(arr: (T | null | undefined)[]): T[] { return arr.filter((x): x is T => x != null); }
export function countBy<T>(arr: T[], fn: (x: T) => string): Record<string, number> { return arr.reduce<Record<string, number>>((acc, x) => { const k = fn(x); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}); }
export function partition<T>(arr: T[], fn: (x: T) => boolean): [T[], T[]] { return arr.reduce<[T[], T[]]>(([y, n], x) => (fn(x) ? [[...y, x], n] : [y, [...n, x]]), [[], []]); }
export function intersection<T>(a: T[], b: T[]): T[] { const s = new Set(b); return a.filter((x) => s.has(x)); }
export function difference<T>(a: T[], b: T[]): T[] { const s = new Set(b); return a.filter((x) => !s.has(x)); }
export function union<T>(a: T[], b: T[]): T[] { return unique([...a, ...b]); }
export function sortBy<T>(arr: T[], fn: (x: T) => number): T[] { return [...arr].sort((a, b) => fn(a) - fn(b)); }
export function reverse<T>(arr: T[]): T[] { return [...arr].reverse(); }
export function flatten2<T>(arr: (T | T[])[]): T[] { return arr.reduce<T[]>((acc, x) => acc.concat(Array.isArray(x) ? x : [x]), []); }
export function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j] as T, a[i] as T]; } return a; }
export function sample<T>(arr: T[]): T | undefined { return arr[Math.floor(Math.random() * arr.length)]; }
export function rotate<T>(arr: T[], n: number): T[] { const len = arr.length; const k = ((n % len) + len) % len; return [...arr.slice(k), ...arr.slice(0, k)]; }
export function fill<T>(n: number, value: T): T[] { return Array(n).fill(value); }
export function times<T>(n: number, fn: (i: number) => T): T[] { return Array.from({ length: n }, (_, i) => fn(i)); }
export function memoize<T extends (...args: unknown[]) => unknown>(fn: T): T { const cache = new Map<string, unknown>(); return ((...args: unknown[]) => { const key = JSON.stringify(args); if (!cache.has(key)) cache.set(key, fn(...args)); return cache.get(key); }) as T; }
export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T { let timer: ReturnType<typeof setTimeout>; return ((...args: unknown[]) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }) as T; }
export function throttle<T extends (...args: unknown[]) => void>(fn: T, ms: number): T { let last = 0; return ((...args: unknown[]) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...args); } }) as T; }
export function once<T extends (...args: unknown[]) => unknown>(fn: T): T { let called = false; let result: unknown; return ((...args: unknown[]) => { if (!called) { called = true; result = fn(...args); } return result; }) as T; }
export function noop(): void { /* intentionally empty */ }
export function identity<T>(x: T): T { return x; }
export function constant<T>(x: T): () => T { return () => x; }
export function pipe<T>(...fns: ((x: T) => T)[]): (x: T) => T { return (x) => fns.reduce((v, f) => f(v), x); }
export function compose<T>(...fns: ((x: T) => T)[]): (x: T) => T { return pipe(...[...fns].reverse()); }
export function partial<T extends (...args: unknown[]) => unknown>(fn: T, ...partial: unknown[]): (...rest: unknown[]) => unknown { return (...rest) => fn(...partial, ...rest); }
export function curry<A, B, C>(fn: (a: A, b: B) => C): (a: A) => (b: B) => C { return (a) => (b) => fn(a, b); }
export function flip<A, B, C>(fn: (a: A, b: B) => C): (b: B, a: A) => C { return (b, a) => fn(a, b); }
export function not<T extends (...args: unknown[]) => boolean>(fn: T): T { return ((...args: unknown[]) => !fn(...args)) as T; }
export function and<T>(...preds: ((x: T) => boolean)[]): (x: T) => boolean { return (x) => preds.every((p) => p(x)); }
export function or<T>(...preds: ((x: T) => boolean)[]): (x: T) => boolean { return (x) => preds.some((p) => p(x)); }
export function xor(a: boolean, b: boolean): boolean { return a !== b; }
export function isNil(x: unknown): x is null | undefined { return x == null; }
export function isDefined<T>(x: T | null | undefined): x is T { return x != null; }
export function isString(x: unknown): x is string { return typeof x === "string"; }
export function isNumber(x: unknown): x is number { return typeof x === "number" && !Number.isNaN(x); }
export function isBoolean(x: unknown): x is boolean { return typeof x === "boolean"; }
export function isObject(x: unknown): x is Record<string, unknown> { return x !== null && typeof x === "object" && !Array.isArray(x); }
export function isArray(x: unknown): x is unknown[] { return Array.isArray(x); }
export function isFunction(x: unknown): x is (...args: unknown[]) => unknown { return typeof x === "function"; }
export function isEmpty(x: string | unknown[] | Record<string, unknown>): boolean { if (isString(x) || isArray(x)) return x.length === 0; if (isObject(x)) return Object.keys(x).length === 0; return false; }
export function deepEqual(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
export function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }
export function merge<T extends Record<string, unknown>>(...objects: Partial<T>[]): T { return Object.assign({}, ...objects) as T; }
export function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> { return Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]])) as Pick<T, K>; }
export function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> { const ks = new Set(keys as string[]); return Object.fromEntries(Object.entries(obj).filter(([k]) => !ks.has(k))) as Omit<T, K>; }
export function mapValues<T extends Record<string, unknown>, V>(obj: T, fn: (v: T[keyof T]) => V): Record<string, V> { return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v as T[keyof T])])); }
export function filterValues<T extends Record<string, unknown>>(obj: T, fn: (v: T[keyof T]) => boolean): Partial<T> { return Object.fromEntries(Object.entries(obj).filter(([, v]) => fn(v as T[keyof T]))) as Partial<T>; }
export function invert(obj: Record<string, string>): Record<string, string> { return Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k])); }
export function entries<T extends Record<string, unknown>>(obj: T): [keyof T, T[keyof T]][] { return Object.entries(obj) as [keyof T, T[keyof T]][]; }
export function fromEntries<V>(entries: [string, V][]): Record<string, V> { return Object.fromEntries(entries); }
export function keys<T extends Record<string, unknown>>(obj: T): (keyof T)[] { return Object.keys(obj) as (keyof T)[]; }
export function values<T extends Record<string, unknown>>(obj: T): T[keyof T][] { return Object.values(obj) as T[keyof T][]; }
export function hasKey<T extends Record<string, unknown>>(obj: T, key: string): key is keyof T & string { return key in obj; }
export function defaults<T extends Record<string, unknown>>(obj: Partial<T>, defs: T): T { return { ...defs, ...obj }; }
export function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
export function camelCase(s: string): string { return s.replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase()); }
export function snakeCase(s: string): string { return s.replace(/([A-Z])/g, "_$1").toLowerCase(); }
export function kebabCase(s: string): string { return snakeCase(s).replace(/_/g, "-"); }
export function trim(s: string): string { return s.trim(); }
export function padStart(s: string, n: number, c = " "): string { return s.padStart(n, c); }
export function padEnd(s: string, n: number, c = " "): string { return s.padEnd(n, c); }
export function repeat(s: string, n: number): string { return s.repeat(n); }
export function startsWith(s: string, prefix: string): boolean { return s.startsWith(prefix); }
export function endsWith(s: string, suffix: string): boolean { return s.endsWith(suffix); }
export function includes(s: string, sub: string): boolean { return s.includes(sub); }
export function splitWords(s: string): string[] { return s.split(/\s+/).filter(Boolean); }
export function truncate(s: string, n: number, ellipsis = "..."): string { return s.length <= n ? s : s.slice(0, n - ellipsis.length) + ellipsis; }
export function escapeHtml(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
export function unescapeHtml(s: string): string { return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\""); }
export function nl2br(s: string): string { return s.replace(/\n/g, "<br>"); }
export function stripHtml(s: string): string { return s.replace(/<[^>]+>/g, ""); }
export function slugify(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
export function uuid(): string { return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); }); }
export function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
