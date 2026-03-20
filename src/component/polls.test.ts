/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("polls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("create a poll", async () => {
    const t = initConvexTest();
    const pollId = await t.mutation(api.polls.create, {
      title: "Best language?",
      options: ["TypeScript", "Rust", "Go"],
      createdBy: "user1",
    });
    expect(pollId).toBeDefined();

    const poll = await t.query(api.polls.get, { pollId });
    expect(poll).not.toBeNull();
    expect(poll!.title).toBe("Best language?");
    expect(poll!.options).toHaveLength(3);
    expect(poll!.status).toBe("active");
    expect(poll!.totalVotes).toBe(0);
    expect(poll!.results).toHaveLength(3);
    expect(poll!.results[0].votes).toBe(0);
    expect(poll!.results[0].percentage).toBe(0);
  });

  test("create poll with default config", async () => {
    const t = initConvexTest();
    const pollId = await t.mutation(api.polls.create, {
      title: "Test?",
      options: ["A", "B"],
      createdBy: "user1",
    });
    const poll = await t.query(api.polls.get, { pollId });
    expect(poll!.config.allowMultipleVotes).toBe(false);
    expect(poll!.config.allowChangeVote).toBe(false);
    expect(poll!.config.showResultsBeforeVote).toBe(true);
  });

  test("create poll with custom config", async () => {
    const t = initConvexTest();
    const pollId = await t.mutation(api.polls.create, {
      title: "Multi vote?",
      options: ["A", "B", "C"],
      createdBy: "user1",
      config: {
        allowMultipleVotes: true,
        maxVotesPerUser: 2,
      },
    });
    const poll = await t.query(api.polls.get, { pollId });
    expect(poll!.config.allowMultipleVotes).toBe(true);
    expect(poll!.config.maxVotesPerUser).toBe(2);
  });

  test("reject empty title", async () => {
    const t = initConvexTest();
    await expect(
      t.mutation(api.polls.create, {
        title: "  ",
        options: ["A", "B"],
        createdBy: "user1",
      }),
    ).rejects.toThrow("Poll title cannot be empty");
  });

  test("reject fewer than 2 options", async () => {
    const t = initConvexTest();
    await expect(
      t.mutation(api.polls.create, {
        title: "Bad poll",
        options: ["Only one"],
        createdBy: "user1",
      }),
    ).rejects.toThrow("at least 2 options");
  });

  test("reject duplicate option text", async () => {
    const t = initConvexTest();
    await expect(
      t.mutation(api.polls.create, {
        title: "Dupe opts",
        options: ["Same", "Same"],
        createdBy: "user1",
      }),
    ).rejects.toThrow("Duplicate option text");
  });

  test("reject duplicate option text case-insensitive", async () => {
    const t = initConvexTest();
    await expect(
      t.mutation(api.polls.create, {
        title: "Dupe opts",
        options: ["Hello", "hello"],
        createdBy: "user1",
      }),
    ).rejects.toThrow("Duplicate option text");
  });

  test("list polls by status", async () => {
    const t = initConvexTest();
    await t.mutation(api.polls.create, {
      title: "Poll 1",
      options: ["A", "B"],
      createdBy: "user1",
    });
    const poll2Id = await t.mutation(api.polls.create, {
      title: "Poll 2",
      options: ["X", "Y"],
      createdBy: "user1",
    });

    let polls = await t.query(api.polls.list, { status: "active" });
    expect(polls).toHaveLength(2);

    await t.mutation(api.polls.close, { pollId: poll2Id });

    polls = await t.query(api.polls.list, { status: "active" });
    expect(polls).toHaveLength(1);
    expect(polls[0].title).toBe("Poll 1");

    const closedPolls = await t.query(api.polls.list, { status: "closed" });
    expect(closedPolls).toHaveLength(1);
    expect(closedPolls[0].title).toBe("Poll 2");
  });

  test("list polls by creator", async () => {
    const t = initConvexTest();
    await t.mutation(api.polls.create, {
      title: "By user1",
      options: ["A", "B"],
      createdBy: "user1",
    });
    await t.mutation(api.polls.create, {
      title: "By user2",
      options: ["A", "B"],
      createdBy: "user2",
    });

    const user1Polls = await t.query(api.polls.list, {
      createdBy: "user1",
    });
    expect(user1Polls).toHaveLength(1);
    expect(user1Polls[0].title).toBe("By user1");
  });

  test("close a poll", async () => {
    const t = initConvexTest();
    const pollId = await t.mutation(api.polls.create, {
      title: "Closeable",
      options: ["A", "B"],
      createdBy: "user1",
    });

    await t.mutation(api.polls.close, { pollId });

    const poll = await t.query(api.polls.get, { pollId });
    expect(poll!.status).toBe("closed");
    expect(poll!.closedAt).toBeDefined();
  });

  test("cannot close already closed poll", async () => {
    const t = initConvexTest();
    const pollId = await t.mutation(api.polls.create, {
      title: "Closeable",
      options: ["A", "B"],
      createdBy: "user1",
    });
    await t.mutation(api.polls.close, { pollId });
    await expect(
      t.mutation(api.polls.close, { pollId }),
    ).rejects.toThrow("already closed");
  });

  test("remove a poll and its votes", async () => {
    const t = initConvexTest();
    const pollId = await t.mutation(api.polls.create, {
      title: "Removable",
      options: ["A", "B"],
      createdBy: "user1",
    });

    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });

    await t.mutation(api.polls.remove, { pollId });

    const poll = await t.query(api.polls.get, { pollId });
    expect(poll).toBeNull();
  });
});
