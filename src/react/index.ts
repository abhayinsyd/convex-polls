"use client";

import { useQuery, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import type {
  PollWithResults,
  PollListItem,
} from "../client/index.js";

// --- API type for hooks ---

export interface PollApi {
  get: FunctionReference<"query", "public">;
  list: FunctionReference<"query", "public">;
  castVote: FunctionReference<"mutation", "public">;
  removeVote: FunctionReference<"mutation", "public">;
  getUserVotes: FunctionReference<"query", "public">;
}

// --- usePoll hook ---

export function usePoll(
  api: PollApi,
  pollId: string,
  voterId?: string,
): {
  poll: PollWithResults | null | undefined;
  isLoading: boolean;
  vote: (optionId: string) => Promise<null>;
  removeVote: (optionId: string) => Promise<null>;
  hasVoted: boolean;
  userVotes: string[];
} {
  const poll = useQuery(api.get, { pollId, voterId }) as
    | PollWithResults
    | null
    | undefined;
  const castVoteMutation = useMutation(api.castVote);
  const removeVoteMutation = useMutation(api.removeVote);

  return {
    poll,
    isLoading: poll === undefined,
    vote: (optionId: string) =>
      castVoteMutation({
        pollId,
        optionId,
        voterId: voterId!,
      }) as Promise<null>,
    removeVote: (optionId: string) =>
      removeVoteMutation({
        pollId,
        optionId,
        voterId: voterId!,
      }) as Promise<null>,
    hasVoted: (poll?.userVotes?.length ?? 0) > 0,
    userVotes: poll?.userVotes ?? [],
  };
}

// --- usePollList hook ---

export function usePollList(
  api: Pick<PollApi, "list">,
  args?: {
    status?: "active" | "closed" | "scheduled";
    createdBy?: string;
    limit?: number;
  },
): {
  polls: PollListItem[];
  isLoading: boolean;
} {
  const polls = useQuery(api.list, args ?? {}) as
    | PollListItem[]
    | undefined;

  return {
    polls: polls ?? [],
    isLoading: polls === undefined,
  };
}

// Re-export types for convenience
export type { PollWithResults, PollListItem } from "../client/index.js";
