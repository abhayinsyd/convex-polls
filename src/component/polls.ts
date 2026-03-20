import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import {
  optionValidator,
  configValidator,
  statusValidator,
} from "./schema.js";

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    options: v.array(v.string()),
    createdBy: v.string(),
    config: v.optional(
      v.object({
        allowMultipleVotes: v.optional(v.boolean()),
        allowChangeVote: v.optional(v.boolean()),
        showResultsBeforeVote: v.optional(v.boolean()),
        closesAt: v.optional(v.number()),
        maxVotesPerUser: v.optional(v.number()),
      }),
    ),
  },
  returns: v.id("polls"),
  handler: async (ctx, args) => {
    if (args.title.trim().length === 0) {
      throw new Error("Poll title cannot be empty.");
    }
    if (args.options.length < 2) {
      throw new Error("A poll requires at least 2 options.");
    }
    for (const opt of args.options) {
      if (opt.trim().length === 0) {
        throw new Error("Poll options cannot be empty.");
      }
    }
    const uniqueTexts = new Set(args.options.map((o) => o.trim().toLowerCase()));
    if (uniqueTexts.size !== args.options.length) {
      throw new Error(
        "Duplicate option text is not allowed. Each option must be unique.",
      );
    }

    const options = args.options.map((text, i) => ({
      id: `opt_${i}`,
      text,
    }));

    const config = {
      allowMultipleVotes: args.config?.allowMultipleVotes ?? false,
      allowChangeVote: args.config?.allowChangeVote ?? false,
      showResultsBeforeVote: args.config?.showResultsBeforeVote ?? true,
      closesAt: args.config?.closesAt,
      maxVotesPerUser: args.config?.maxVotesPerUser,
    };

    if (
      config.maxVotesPerUser !== undefined &&
      config.maxVotesPerUser < 1
    ) {
      throw new Error("maxVotesPerUser must be at least 1.");
    }

    const pollId = await ctx.db.insert("polls", {
      title: args.title.trim(),
      description: args.description?.trim(),
      options,
      createdBy: args.createdBy,
      status: "active",
      config,
      createdAt: Date.now(),
    });

    return pollId;
  },
});

const pollResultValidator = v.object({
  id: v.string(),
  text: v.string(),
  votes: v.number(),
  percentage: v.number(),
});

const pollWithResultsValidator = v.object({
  _id: v.id("polls"),
  _creationTime: v.number(),
  title: v.string(),
  description: v.optional(v.string()),
  options: v.array(optionValidator),
  createdBy: v.string(),
  status: statusValidator,
  config: configValidator,
  createdAt: v.number(),
  closedAt: v.optional(v.number()),
  results: v.array(pollResultValidator),
  totalVotes: v.number(),
  userVotes: v.array(v.string()),
});

export const get = query({
  args: {
    pollId: v.id("polls"),
    voterId: v.optional(v.string()),
  },
  returns: v.union(v.null(), pollWithResultsValidator),
  handler: async (ctx, args) => {
    const poll = await ctx.db.get(args.pollId);
    if (!poll) return null;

    const allVotes = await ctx.db
      .query("votes")
      .withIndex("by_poll", (q) => q.eq("pollId", args.pollId))
      .collect();

    const voteCounts: Record<string, number> = {};
    const userVoteOptionIds: string[] = [];

    for (const vote of allVotes) {
      voteCounts[vote.optionId] = (voteCounts[vote.optionId] ?? 0) + 1;
      if (args.voterId && vote.voterId === args.voterId) {
        userVoteOptionIds.push(vote.optionId);
      }
    }

    const totalVotes = allVotes.length;

    const results = poll.options.map((opt) => {
      const count = voteCounts[opt.id] ?? 0;
      return {
        id: opt.id,
        text: opt.text,
        votes: count,
        percentage: totalVotes > 0 ? (count / totalVotes) * 100 : 0,
      };
    });

    return {
      ...poll,
      results,
      totalVotes,
      userVotes: userVoteOptionIds,
    };
  },
});

const pollListItemValidator = v.object({
  _id: v.id("polls"),
  _creationTime: v.number(),
  title: v.string(),
  description: v.optional(v.string()),
  options: v.array(optionValidator),
  createdBy: v.string(),
  status: statusValidator,
  config: configValidator,
  createdAt: v.number(),
  closedAt: v.optional(v.number()),
  totalVotes: v.number(),
});

export const list = query({
  args: {
    status: v.optional(statusValidator),
    createdBy: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(pollListItemValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    let polls;

    if (args.status !== undefined && args.createdBy !== undefined) {
      const allMatching = await ctx.db
        .query("polls")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
      polls = allMatching
        .filter((p) => p.createdBy === args.createdBy)
        .slice(0, limit);
    } else if (args.status !== undefined) {
      polls = await ctx.db
        .query("polls")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    } else if (args.createdBy !== undefined) {
      polls = await ctx.db
        .query("polls")
        .withIndex("by_creator", (q) =>
          q.eq("createdBy", args.createdBy!),
        )
        .order("desc")
        .take(limit);
    } else {
      polls = await ctx.db.query("polls").order("desc").take(limit);
    }

    const now = Date.now();
    const results = [];
    for (const poll of polls) {
      // Skip expired polls when filtering for "active"
      if (
        args.status === "active" &&
        poll.config.closesAt &&
        now > poll.config.closesAt
      ) {
        continue;
      }
      const voteCount = await ctx.db
        .query("votes")
        .withIndex("by_poll", (q) => q.eq("pollId", poll._id))
        .collect();
      results.push({
        ...poll,
        totalVotes: voteCount.length,
      });
    }

    return results;
  },
});

export const close = mutation({
  args: {
    pollId: v.id("polls"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const poll = await ctx.db.get(args.pollId);
    if (!poll) {
      throw new Error("Poll not found. The poll may have been deleted.");
    }
    if (poll.status === "closed") {
      throw new Error("Poll is already closed.");
    }
    await ctx.db.patch(args.pollId, {
      status: "closed",
      closedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    pollId: v.id("polls"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const poll = await ctx.db.get(args.pollId);
    if (!poll) {
      throw new Error("Poll not found. The poll may have been deleted.");
    }

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_poll", (q) => q.eq("pollId", args.pollId))
      .collect();
    for (const vote of votes) {
      await ctx.db.delete(vote._id);
    }

    await ctx.db.delete(args.pollId);
    return null;
  },
});
