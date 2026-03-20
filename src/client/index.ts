import {
  queryGeneric,
  mutationGeneric,
} from "convex/server";
import type {
  GenericMutationCtx,
  GenericQueryCtx,
  GenericDataModel,
} from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";
import {
  statusValidator,
} from "../component/schema.js";

// --- Type definitions for public API ---

export interface CreatePollArgs {
  title: string;
  description?: string;
  options: string[];
  createdBy: string;
  config?: {
    allowMultipleVotes?: boolean;
    allowChangeVote?: boolean;
    showResultsBeforeVote?: boolean;
    closesAt?: number;
    maxVotesPerUser?: number;
  };
}

export interface PollOption {
  id: string;
  text: string;
}

export interface PollConfig {
  allowMultipleVotes: boolean;
  allowChangeVote: boolean;
  showResultsBeforeVote: boolean;
  closesAt?: number;
  maxVotesPerUser?: number;
}

export interface PollOptionResult {
  id: string;
  text: string;
  votes: number;
  percentage: number;
}

export interface PollWithResults {
  _id: string;
  _creationTime: number;
  title: string;
  description?: string;
  options: PollOption[];
  createdBy: string;
  status: "active" | "closed" | "scheduled";
  config: PollConfig;
  createdAt: number;
  closedAt?: number;
  results: PollOptionResult[];
  totalVotes: number;
  userVotes: string[];
}

export interface PollListItem {
  _id: string;
  _creationTime: number;
  title: string;
  description?: string;
  options: PollOption[];
  createdBy: string;
  status: "active" | "closed" | "scheduled";
  config: PollConfig;
  createdAt: number;
  closedAt?: number;
  totalVotes: number;
}

export interface ListPollsArgs {
  status?: "active" | "closed" | "scheduled";
  createdBy?: string;
  limit?: number;
}

export interface CastVoteArgs {
  pollId: string;
  optionId: string;
  voterId: string;
}

export interface RemoveVoteArgs {
  pollId: string;
  optionId: string;
  voterId: string;
}

// --- Minimal context types ---

type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;

// --- Polls client class ---

export class Polls {
  constructor(private component: ComponentApi) {}

  async create(ctx: MutationCtx, args: CreatePollArgs): Promise<string> {
    return await ctx.runMutation(this.component.polls.create, args);
  }

  async get(
    ctx: QueryCtx,
    pollId: string,
    voterId?: string,
  ): Promise<PollWithResults | null> {
    return await ctx.runQuery(this.component.polls.get, {
      pollId,
      voterId,
    });
  }

  async list(
    ctx: QueryCtx,
    args?: ListPollsArgs,
  ): Promise<PollListItem[]> {
    return await ctx.runQuery(this.component.polls.list, args ?? {});
  }

  async vote(ctx: MutationCtx, args: CastVoteArgs): Promise<null> {
    return await ctx.runMutation(this.component.votes.castVote, args);
  }

  async removeVote(ctx: MutationCtx, args: RemoveVoteArgs): Promise<null> {
    return await ctx.runMutation(this.component.votes.removeVote, args);
  }

  async close(ctx: MutationCtx, pollId: string): Promise<null> {
    return await ctx.runMutation(this.component.polls.close, { pollId });
  }

  async remove(ctx: MutationCtx, pollId: string): Promise<null> {
    return await ctx.runMutation(this.component.polls.remove, { pollId });
  }

  async getUserVotes(
    ctx: QueryCtx,
    pollId: string,
    voterId: string,
  ): Promise<string[]> {
    return await ctx.runQuery(this.component.votes.getUserVotes, {
      pollId,
      voterId,
    });
  }
}

// --- Helper to create re-exportable API for React hooks ---

export function createPollApi(component: ComponentApi) {
  return {
    create: mutationGeneric({
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
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.polls.create, args);
      },
    }),

    get: queryGeneric({
      args: {
        pollId: v.string(),
        voterId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.polls.get, args);
      },
    }),

    list: queryGeneric({
      args: {
        status: v.optional(statusValidator),
        createdBy: v.optional(v.string()),
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.polls.list, args);
      },
    }),

    castVote: mutationGeneric({
      args: {
        pollId: v.string(),
        optionId: v.string(),
        voterId: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.votes.castVote, args);
      },
    }),

    removeVote: mutationGeneric({
      args: {
        pollId: v.string(),
        optionId: v.string(),
        voterId: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.votes.removeVote, args);
      },
    }),

    close: mutationGeneric({
      args: {
        pollId: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.polls.close, args);
      },
    }),

    remove: mutationGeneric({
      args: {
        pollId: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runMutation(component.polls.remove, args);
      },
    }),

    getUserVotes: queryGeneric({
      args: {
        pollId: v.string(),
        voterId: v.string(),
      },
      handler: async (ctx, args) => {
        return await ctx.runQuery(component.votes.getUserVotes, args);
      },
    }),
  };
}
