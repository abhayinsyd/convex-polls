import { query, mutation } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { createPollApi, Polls } from "convex-polls";
import { v } from "convex/values";

// Re-export the full poll API for use with React hooks.
// These thin wrappers delegate to the component's internal functions.
export const {
  create,
  get,
  list,
  castVote,
  removeVote,
  close,
  remove,
  getUserVotes,
} = createPollApi(components.convexPolls);

// --- Alternative: use the Polls class directly in custom functions ---

const polls = new Polls(components.convexPolls);

export const createPoll = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    options: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // In a real app, you'd get the user ID from auth:
    // const userId = (await ctx.auth.getUserIdentity())?.subject;
    const userId = "demo-user";
    return await polls.create(ctx, {
      ...args,
      createdBy: userId,
    });
  },
});

export const getPoll = query({
  args: {
    pollId: v.string(),
  },
  handler: async (ctx, args) => {
    return await polls.get(ctx, args.pollId, "demo-user");
  },
});
