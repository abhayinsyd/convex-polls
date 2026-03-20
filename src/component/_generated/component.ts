/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    polls: {
      close: FunctionReference<
        "mutation",
        "internal",
        { pollId: string },
        null,
        Name
      >;
      create: FunctionReference<
        "mutation",
        "internal",
        {
          config?: {
            allowChangeVote?: boolean;
            allowMultipleVotes?: boolean;
            closesAt?: number;
            maxVotesPerUser?: number;
            showResultsBeforeVote?: boolean;
          };
          createdBy: string;
          description?: string;
          options: Array<string>;
          title: string;
        },
        string,
        Name
      >;
      get: FunctionReference<
        "query",
        "internal",
        { pollId: string; voterId?: string },
        null | {
          _creationTime: number;
          _id: string;
          closedAt?: number;
          config: {
            allowChangeVote: boolean;
            allowMultipleVotes: boolean;
            closesAt?: number;
            maxVotesPerUser?: number;
            showResultsBeforeVote: boolean;
          };
          createdAt: number;
          createdBy: string;
          description?: string;
          options: Array<{ id: string; text: string }>;
          results: Array<{
            id: string;
            percentage: number;
            text: string;
            votes: number;
          }>;
          status: "active" | "closed" | "scheduled";
          title: string;
          totalVotes: number;
          userVotes: Array<string>;
        },
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          createdBy?: string;
          limit?: number;
          status?: "active" | "closed" | "scheduled";
        },
        Array<{
          _creationTime: number;
          _id: string;
          closedAt?: number;
          config: {
            allowChangeVote: boolean;
            allowMultipleVotes: boolean;
            closesAt?: number;
            maxVotesPerUser?: number;
            showResultsBeforeVote: boolean;
          };
          createdAt: number;
          createdBy: string;
          description?: string;
          options: Array<{ id: string; text: string }>;
          status: "active" | "closed" | "scheduled";
          title: string;
          totalVotes: number;
        }>,
        Name
      >;
      remove: FunctionReference<
        "mutation",
        "internal",
        { pollId: string },
        null,
        Name
      >;
    };
    votes: {
      castVote: FunctionReference<
        "mutation",
        "internal",
        { optionId: string; pollId: string; voterId: string },
        null,
        Name
      >;
      getUserVotes: FunctionReference<
        "query",
        "internal",
        { pollId: string; voterId: string },
        Array<string>,
        Name
      >;
      removeVote: FunctionReference<
        "mutation",
        "internal",
        { optionId: string; pollId: string; voterId: string },
        null,
        Name
      >;
    };
  };
