import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const optionValidator = v.object({
  id: v.string(),
  text: v.string(),
});

export const configValidator = v.object({
  allowMultipleVotes: v.boolean(),
  allowChangeVote: v.boolean(),
  showResultsBeforeVote: v.boolean(),
  closesAt: v.optional(v.number()),
  maxVotesPerUser: v.optional(v.number()),
});

export const statusValidator = v.union(
  v.literal("active"),
  v.literal("closed"),
  v.literal("scheduled"),
);

export default defineSchema({
  polls: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    options: v.array(optionValidator),
    createdBy: v.string(),
    status: statusValidator,
    config: configValidator,
    createdAt: v.number(),
    closedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_creator", ["createdBy"]),

  votes: defineTable({
    pollId: v.id("polls"),
    optionId: v.string(),
    voterId: v.string(),
    votedAt: v.number(),
  })
    .index("by_poll", ["pollId"])
    .index("by_poll_voter", ["pollId", "voterId"])
    .index("by_poll_option", ["pollId", "optionId"]),
});
