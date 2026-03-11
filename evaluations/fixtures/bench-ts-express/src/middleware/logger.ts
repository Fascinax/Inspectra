import type { Request, Response, NextFunction } from "express";

// TODO: replace with proper logging library (winston or pino)
// FIXME: this middleware leaks memory on high traffic

export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  const start = Date.now();
  const method = req.method;
  const url = req.url;
  const userAgent = req.headers["user-agent"] ?? "unknown";
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const contentLength = req.headers["content-length"] ?? "0";
  const referer = req.headers["referer"] ?? "";
  const acceptLanguage = req.headers["accept-language"] ?? "";
  const host = req.headers["host"] ?? "";
  const protocol = req.protocol;
  const isSecure = req.secure;
  const query = JSON.stringify(req.query);
  const params = JSON.stringify(req.params);
  const timestamp = new Date().toISOString();

  let logLevel = "info";
  if (method === "DELETE") logLevel = "warn";
  if (url.includes("/admin")) logLevel = "warn";
  if (url.includes("/health")) logLevel = "debug";

  const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const logEntry = {
    requestId,
    timestamp,
    method,
    url,
    userAgent,
    ip,
    contentLength,
    referer,
    acceptLanguage,
    host,
    protocol,
    isSecure,
    query,
    params,
    logLevel,
    durationMs: 0,
  };

  console.log(`[${logLevel.toUpperCase()}] ${method} ${url} - ${ip} - ${userAgent.substring(0, 50)}`);
  console.log(`  Request ID: ${requestId}`);
  console.log(`  Host: ${host}, Protocol: ${protocol}, Secure: ${isSecure}`);
  console.log(`  Content-Length: ${contentLength}, Referer: ${referer}`);
  console.log(`  Accept-Language: ${acceptLanguage}`);
  console.log(`  Query: ${query}`);
  console.log(`  Params: ${params}`);

  const elapsed = Date.now() - start;
  logEntry.durationMs = elapsed;

  if (elapsed > 1000) {
    console.log(`  SLOW REQUEST (${elapsed}ms): ${method} ${url}`);
  }
  if (elapsed > 5000) {
    console.log(`  CRITICAL SLOW REQUEST (${elapsed}ms): ${method} ${url}`);
  }

  next();
}
