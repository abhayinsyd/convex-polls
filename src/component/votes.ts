import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

export const castVote = mutation({
  args: {
    pollId: v.id("polls"),
    optionId: v.string(),
    voterId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.voterId.trim()) {
      throw new Error("Voter ID is required.");
    }

    const poll = await ctx.db.get(args.pollId);
    if (!poll) {
      throw new Error("Poll not found. The poll may have been deleted.");
    }

    if (poll.status === "closed") {
      throw new Error("This poll is closed and no longer accepting votes.");
    }

    if (poll.config.closesAt && Date.now() > poll.config.closesAt) {
      throw new Error(
        "This poll has expired and is no longer accepting votes.",
      );
    }

    const validOptionIds = poll.options.map((o) => o.id);
    if (!validOptionIds.includes(args.optionId)) {
      throw new Error(
        `Invalid option "${args.optionId}". Valid options: ${validOptionIds.join(", ")}`,
      );
    }

    const existingVotes = await ctx.db
      .query("votes")
      .withIndex("by_poll_voter", (q) =>
        q.eq("pollId", args.pollId).eq("voterId", args.voterId),
      )
      .collect();

    if (!poll.config.allowMultipleVotes && !poll.config.allowChangeVote) {
      if (existingVotes.length > 0) {
        throw new Error(
          "You have already voted on this poll. This poll does not allow changing or adding votes.",
        );
      }
    }

    if (!poll.config.allowMultipleVotes && poll.config.allowChangeVote) {
      for (const oldVote of existingVotes) {
        await ctx.db.delete(oldVote._id);
      }
    }

    if (poll.config.allowMultipleVotes) {
      const alreadyVotedForOption = existingVotes.some(
        (v) => v.optionId === args.optionId,
      );
      if (alreadyVotedForOption) {
        throw new Error("You have already voted for this option.");
      }

      const maxVotes =
        poll.config.maxVotesPerUser ?? poll.options.length;
      if (existingVotes.length >= maxVotes) {
        throw new Error(
          `You can only vote for up to ${maxVotes} option${maxVotes === 1 ? "" : "s"} on this poll.`,
        );
      }
    }

    await ctx.db.insert("votes", {
      pollId: args.pollId,
      optionId: args.optionId,
      voterId: args.voterId,
      votedAt: Date.now(),
    });

    return null;
  },
});

export const removeVote = mutation({
  args: {
    pollId: v.id("polls"),
    optionId: v.string(),
    voterId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.voterId.trim()) {
      throw new Error("Voter ID is required.");
    }

    const poll = await ctx.db.get(args.pollId);
    if (!poll) {
      throw new Error("Poll not found. The poll may have been deleted.");
    }

    if (poll.status === "closed") {
      throw new Error("Cannot remove votes from a closed poll.");
    }

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_poll_voter", (q) =>
        q.eq("pollId", args.pollId).eq("voterId", args.voterId),
      )
      .collect();

    const voteToRemove = votes.find((v) => v.optionId === args.optionId);
    if (!voteToRemove) {
      throw new Error("No vote found for this option.");
    }

    await ctx.db.delete(voteToRemove._id);
    return null;
  },
});

export const getUserVotes = query({
  args: {
    pollId: v.id("polls"),
    voterId: v.string(),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_poll_voter", (q) =>
        q.eq("pollId", args.pollId).eq("voterId", args.voterId),
      )
      .collect();

    return votes.map((v) => v.optionId);
  },
});
