import { describe, expect, test } from "vitest";
import { createPollApi } from "./index.js";
import { anyApi, type ApiFromModules } from "convex/server";
import { components, initConvexTest } from "./setup.test.js";

export const { create, get, list, castVote, removeVote, close, getUserVotes } =
  createPollApi(components.convexPolls);

const testApi = (
  anyApi as unknown as ApiFromModules<{
    "index.test": {
      create: typeof create;
      get: typeof get;
      list: typeof list;
      castVote: typeof castVote;
      removeVote: typeof removeVote;
      close: typeof close;
      getUserVotes: typeof getUserVotes;
    };
  }>
)["index.test"];

describe("client API tests", () => {
  test("create and get poll via client API", async () => {
    const t = initConvexTest().withIdentity({ subject: "user1" });
    const pollId = await t.mutation(testApi.create, {
      title: "Client test poll",
      options: ["Option A", "Option B"],
      createdBy: "user1",
    });

    const poll = await t.query(testApi.get, { pollId });
    expect(poll).not.toBeNull();
    expect(poll!.title).toBe("Client test poll");
    expect(poll!.totalVotes).toBe(0);
  });

  test("vote and see results via client API", async () => {
    const t = initConvexTest().withIdentity({ subject: "voter1" });
    const pollId = await t.mutation(testApi.create, {
      title: "Vote test",
      options: ["Yes", "No"],
      createdBy: "user1",
    });

    await t.mutation(testApi.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });

    const poll = await t.query(testApi.get, {
      pollId,
      voterId: "voter1",
    });
    expect(poll!.totalVotes).toBe(1);
    expect(poll!.userVotes).toEqual(["opt_0"]);
  });

  test("list polls via client API", async () => {
    const t = initConvexTest().withIdentity({ subject: "user1" });
    await t.mutation(testApi.create, {
      title: "Poll 1",
      options: ["A", "B"],
      createdBy: "user1",
    });
    await t.mutation(testApi.create, {
      title: "Poll 2",
      options: ["X", "Y"],
      createdBy: "user1",
    });

    const polls = await t.query(testApi.list, {});
    expect(polls).toHaveLength(2);
  });

  test("close poll via client API", async () => {
    const t = initConvexTest().withIdentity({ subject: "user1" });
    const pollId = await t.mutation(testApi.create, {
      title: "Closeable",
      options: ["A", "B"],
      createdBy: "user1",
    });

    await t.mutation(testApi.close, { pollId });

    const poll = await t.query(testApi.get, { pollId });
    expect(poll!.status).toBe("closed");
  });
});
