import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveSnapshot = mutation({
  args: {
    source: v.string(),
    data: v.any(),
    exportedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("backups", {
      source: args.source,
      data: args.data,
      exportedAt: args.exportedAt,
      updatedAt: now,
    });
    return { ok: true, updatedAt: now };
  },
});

export const getLatestSnapshot = query({
  args: {
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("backups")
      .withIndex("by_source_updatedAt", (q) => q.eq("source", args.source))
      .order("desc")
      .first();

    if (!latest) return null;

    return {
      source: latest.source,
      exportedAt: latest.exportedAt,
      updatedAt: latest.updatedAt,
      data: latest.data,
    };
  },
});
