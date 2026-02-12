import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

function isAuthorized(request: Request) {
  const requiredKey = process.env.CONVEX_SYNC_KEY;
  if (!requiredKey) return true;
  const providedKey = request.headers.get("x-sync-key") || "";
  return providedKey === requiredKey;
}

http.route({
  path: "/backup",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isAuthorized(request)) {
      return json({ error: "Unauthorized: invalid x-sync-key" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const source = typeof payload?.source === "string" ? payload.source : "readlater_todos_extension";
    const data = payload?.data;
    const exportedAt = Number(payload?.exportedAt || Date.now());

    if (!data || typeof data !== "object") {
      return json({ error: "Missing or invalid 'data' payload" }, { status: 400 });
    }

    const result = await ctx.runMutation(api.backups.saveSnapshot, {
      source,
      data,
      exportedAt,
    });

    return json({ ok: true, source, ...result });
  }),
});

http.route({
  path: "/restore",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isAuthorized(request)) {
      return json({ error: "Unauthorized: invalid x-sync-key" }, { status: 401 });
    }

    let payload: any = {};
    try {
      payload = await request.json();
    } catch {
      // allow empty body fallback
    }

    const source = typeof payload?.source === "string" ? payload.source : "readlater_todos_extension";
    const latest = await ctx.runQuery(api.backups.getLatestSnapshot, { source });

    if (!latest) {
      return json({ error: `No backup found for source '${source}'` }, { status: 404 });
    }

    return json({
      source: latest.source,
      exportedAt: latest.exportedAt,
      updatedAt: latest.updatedAt,
      data: latest.data,
    });
  }),
});

export default http;
