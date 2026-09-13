import { createServer, type IncomingMessage } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { identifier } from "../core/types.js";
import type { DashboardBridge } from "./bridge.js";
import { html, javascript, css } from "./assets.js";
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
async function body(req: IncomingMessage): Promise<unknown> {
  if (req.headers["content-type"] !== "application/json")
    throw new HttpError(415, "Expected application/json");
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 16_384) throw new HttpError(413, "Request body too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
export async function startDashboard({
  bridge,
  port = 4317,
  actor = "local-operator",
}: {
  bridge: DashboardBridge;
  port?: number;
  actor?: string;
}): Promise<{ url: string; close: () => Promise<void> }> {
  z.string().min(1).max(200).parse(actor);
  const token = randomBytes(32).toString("hex");
  const active = new Set<string>();
  const errors = new Map<string, string>();
  let origin = "";
  const server = createServer(async (req, res) => {
    const send = (status: number, data: unknown, type = "application/json") => {
      res.writeHead(status, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      });
      res.end(
        type === "application/json" ? JSON.stringify(data) : (data as string),
      );
    };
    try {
      if (req.headers.host !== new URL(origin).host)
        throw new HttpError(403, "Invalid Host");
      if (req.headers.origin && req.headers.origin !== origin)
        throw new HttpError(403, "Invalid Origin");
      const raw = req.url ?? "/";
      if (
        /%2f|%5c|%2e|\\/i.test(raw) ||
        raw.split("?")[0]!.split("/").includes("..")
      )
        throw new HttpError(400, "Invalid path");
      const url = new URL(raw, origin);
      if (req.method === "POST") {
        if (req.headers.origin !== origin)
          throw new HttpError(403, "Exact Origin required");
        const supplied = req.headers["x-dashboard-token"];
        if (
          typeof supplied !== "string" ||
          !/^[a-f0-9]{64}$/.test(supplied) ||
          !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
        )
          throw new HttpError(403, "Invalid mutation token");
      }
      if (req.method === "GET" && url.pathname === "/")
        return send(200, html(token), "text/html; charset=utf-8");
      if (req.method === "GET" && url.pathname === "/app.js")
        return send(200, javascript, "text/javascript; charset=utf-8");
      if (req.method === "GET" && url.pathname === "/style.css")
        return send(200, css, "text/css; charset=utf-8");
      if (req.method === "GET" && url.pathname === "/api/runs")
        return send(200, await bridge.listRuns());
      if (req.method === "GET" && url.pathname === "/api/compare")
        return send(
          200,
          await bridge.compare([
            identifier.parse(url.searchParams.get("baseline")),
            identifier.parse(url.searchParams.get("candidate")),
          ]),
        );
      const match = /^\/api\/runs\/([^/]+)(?:\/(approval|resume))?$/.exec(
        url.pathname,
      );
      if (!match) throw new HttpError(404, "Route not found");
      const id = identifier.parse(decodeURIComponent(match[1]!));
      const inspect = async () => {
        try {
          return await bridge.inspect(id);
        } catch (error) {
          if (
            /not found|does not exist|no events|empty|missing/i.test(
              String(error),
            )
          )
            throw new HttpError(404, "Run not found");
          throw error;
        }
      };
      if (req.method === "GET" && !match[2])
        return send(200, {
          ...(await inspect()),
          dashboard: {
            resuming: active.has(id),
            resumeError: errors.get(id) ?? null,
          },
        });
      if (req.method === "POST" && match[2] === "approval") {
        const input = z
          .strictObject({
            digest: z.string().min(1).max(256),
            allow: z.boolean(),
          })
          .parse(await body(req));
        await inspect();
        return send(
          200,
          await bridge.approve(id, input.digest, actor, input.allow),
        );
      }
      if (req.method === "POST" && match[2] === "resume") {
        z.strictObject({}).parse(await body(req));
        if (active.has(id))
          throw new HttpError(409, "Resume already in progress");
        await inspect();
        if (active.has(id))
          throw new HttpError(409, "Resume already in progress");
        active.add(id);
        errors.delete(id);
        send(202, { queued: true });
        void Promise.resolve()
          .then(() => bridge.resume(id))
          .catch((error) =>
            errors.set(
              id,
              error instanceof Error ? error.message : "Resume failed",
            ),
          )
          .finally(() => active.delete(id));
        return;
      }
      throw new HttpError(405, "Method not allowed");
    } catch (error) {
      send(
        error instanceof HttpError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 409,
        { error: error instanceof Error ? error.message : "Request failed" },
      );
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No server address");
  origin = `http://127.0.0.1:${address.port}`;
  return {
    url: origin,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
