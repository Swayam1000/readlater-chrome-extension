import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  backups: defineTable({
    source: v.string(),
    data: v.any(),
    exportedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_source_updatedAt", ["source", "updatedAt"]),
});
