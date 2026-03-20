/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

async function createActivePoll(
  t: ReturnType<typeof initConvexTest>,
  overrides?: { config?: Record<string, unknown> },
) {
  return await t.mutation(api.polls.create, {
    title: "Test Poll",
    options: ["Alpha", "Beta", "Gamma"],
    createdBy: "creator",
    ...overrides,
  });
}

describe("votes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("reject empty voterId on castVote", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t);

    await expect(
      t.mutation(api.votes.castVote, {
        pollId,
        optionId: "opt_0",
        voterId: "  ",
      }),
    ).rejects.toThrow("Voter ID is required");
  });

  test("reject empty voterId on removeVote", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t);

    await expect(
      t.mutation(api.votes.removeVote, {
        pollId,
        optionId: "opt_0",
        voterId: "",
      }),
    ).rejects.toThrow("Voter ID is required");
  });

  test("cast a vote and verify counts", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t);

    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });

    const poll = await t.query(api.polls.get, { pollId });
    expect(poll!.totalVotes).toBe(1);
    expect(poll!.results[0].votes).toBe(1);
    expect(poll!.results[0].percentage).toBe(100);
    expect(poll!.results[1].votes).toBe(0);
  });

  test("multiple voters", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t);

    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });
    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_1",
      voterId: "voter2",
    });
    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter3",
    });

    const poll = await t.query(api.polls.get, { pollId });
    expect(poll!.totalVotes).toBe(3);
    expect(poll!.results[0].votes).toBe(2);
    expect(poll!.results[1].votes).toBe(1);
    expect(poll!.results[0].percentage).toBeCloseTo(66.67, 0);
    expect(poll!.results[1].percentage).toBeCloseTo(33.33, 0);
  });

  test("reject duplicate vote when allowMultipleVotes is false", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t);

    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });

    await expect(
      t.mutation(api.votes.castVote, {
        pollId,
        optionId: "opt_1",
        voterId: "voter1",
      }),
    ).rejects.toThrow("already voted");
  });

  test("reject vote on closed poll", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t);

    await t.mutation(api.polls.close, { pollId });

    await expect(
      t.mutation(api.votes.castVote, {
        pollId,
        optionId: "opt_0",
        voterId: "voter1",
      }),
    ).rejects.toThrow("closed");
  });

  test("reject vote on expired poll", async () => {
    const t = initConvexTest();
    const closesAt = Date.now() + 1000;
    const pollId = await createActivePoll(t, {
      config: { closesAt },
    });

    vi.advanceTimersByTime(2000);

    await expect(
      t.mutation(api.votes.castVote, {
        pollId,
        optionId: "opt_0",
        voterId: "voter1",
      }),
    ).rejects.toThrow("expired");
  });

  test("reject invalid option ID", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t);

    await expect(
      t.mutation(api.votes.castVote, {
        pollId,
        optionId: "nonexistent",
        voterId: "voter1",
      }),
    ).rejects.toThrow("Invalid option");
  });

  test("allowChangeVote replaces old vote", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t, {
      config: { allowChangeVote: true },
    });

    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });

    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_1",
      voterId: "voter1",
    });

    const poll = await t.query(api.polls.get, { pollId, voterId: "voter1" });
    expect(poll!.totalVotes).toBe(1);
    expect(poll!.results[0].votes).toBe(0);
    expect(poll!.results[1].votes).toBe(1);
    expect(poll!.userVotes).toEqual(["opt_1"]);
  });

  test("allowMultipleVotes lets user vote for multiple options", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t, {
      config: { allowMultipleVotes: true },
    });

    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });
    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_1",
      voterId: "voter1",
    });

    const poll = await t.query(api.polls.get, { pollId, voterId: "voter1" });
    expect(poll!.totalVotes).toBe(2);
    expect(poll!.userVotes).toHaveLength(2);
    expect(poll!.userVotes).toContain("opt_0");
    expect(poll!.userVotes).toContain("opt_1");
  });

  test("maxVotesPerUser is enforced", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t, {
      config: { allowMultipleVotes: true, maxVotesPerUser: 2 },
    });

    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });
    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_1",
      voterId: "voter1",
    });

    await expect(
      t.mutation(api.votes.castVote, {
        pollId,
        optionId: "opt_2",
        voterId: "voter1",
      }),
    ).rejects.toThrow("up to 2 options");
  });

  test("prevent duplicate vote for same option with allowMultipleVotes", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t, {
      config: { allowMultipleVotes: true },
    });

    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });

    await expect(
      t.mutation(api.votes.castVote, {
        pollId,
        optionId: "opt_0",
        voterId: "voter1",
      }),
    ).rejects.toThrow("already voted for this option");
  });

  test("removeVote works", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t);

    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });

    await t.mutation(api.votes.removeVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });

    const poll = await t.query(api.polls.get, { pollId, voterId: "voter1" });
    expect(poll!.totalVotes).toBe(0);
    expect(poll!.userVotes).toHaveLength(0);
  });

  test("getUserVotes returns correct option IDs", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t, {
      config: { allowMultipleVotes: true },
    });

    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });
    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_2",
      voterId: "voter1",
    });

    const votes = await t.query(api.votes.getUserVotes, {
      pollId,
      voterId: "voter1",
    });
    expect(votes).toHaveLength(2);
    expect(votes).toContain("opt_0");
    expect(votes).toContain("opt_2");
  });

  test("get poll includes userVotes for specific voter", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t);

    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });
    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_1",
      voterId: "voter2",
    });

    const pollAsVoter1 = await t.query(api.polls.get, {
      pollId,
      voterId: "voter1",
    });
    expect(pollAsVoter1!.userVotes).toEqual(["opt_0"]);

    const pollAsVoter2 = await t.query(api.polls.get, {
      pollId,
      voterId: "voter2",
    });
    expect(pollAsVoter2!.userVotes).toEqual(["opt_1"]);

    // Without voterId, userVotes should be empty
    const pollNoVoter = await t.query(api.polls.get, { pollId });
    expect(pollNoVoter!.userVotes).toHaveLength(0);
  });

  test("list polls includes totalVotes", async () => {
    const t = initConvexTest();
    const pollId = await createActivePoll(t);

    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_0",
      voterId: "voter1",
    });
    await t.mutation(api.votes.castVote, {
      pollId,
      optionId: "opt_1",
      voterId: "voter2",
    });

    const polls = await t.query(api.polls.list, {});
    expect(polls[0].totalVotes).toBe(2);
  });
});
