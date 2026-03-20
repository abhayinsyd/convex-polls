# convex-polls

Real-time polls and voting for Convex apps. Drop in, start voting, see results update live across all connected clients.

[![npm version](https://img.shields.io/npm/v/convex-polls.svg)](https://www.npmjs.com/package/convex-polls)

## Features

- **Real-time results** -- votes update instantly across all clients via Convex reactivity
- **Configurable voting** -- single vote, multiple choice, change vote, anonymous
- **Auto-close** -- polls can automatically close at a specified time
- **React hooks** -- `usePoll()` and `usePollList()` for seamless integration
- **Type-safe** -- full TypeScript support with exported types and Convex validators on every function
- **Zero dependencies** -- just Convex and React as peer deps
- **Isolated data** -- component uses its own tables, won't conflict with your schema
- **Zero conflicts** -- vote counts are computed at query time, not stored, enabling high-concurrency voting

## Quick Start

### 1. Install

```bash
npm install convex-polls convex
```

### 2. Add to your Convex config

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import convexPolls from "convex-polls/convex.config.js";

const app = defineApp();
app.use(convexPolls);
export default app;
```

### 3. Create wrapper functions

Re-export the component's API so your React app can call it:

```ts
// convex/polls.ts
import { createPollApi } from "convex-polls";
import { components } from "./_generated/api.js";

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
```

### 4. Use in React

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function Poll({ pollId, voterId }: { pollId: string; voterId: string }) {
  const poll = useQuery(api.polls.get, { pollId, voterId });
  const vote = useMutation(api.polls.castVote);

  if (!poll) return <div>Loading...</div>;

  return (
    <div>
      <h2>{poll.title}</h2>
      {poll.results.map((option) => (
        <button
          key={option.id}
          onClick={() => vote({ pollId, optionId: option.id, voterId })}
        >
          {option.text} -- {option.votes} votes ({option.percentage.toFixed(0)}%)
        </button>
      ))}
      <p>Total: {poll.totalVotes} votes</p>
    </div>
  );
}
```

Open two browser tabs -- vote in one and watch the other update instantly.

## API Reference

### `Polls` class

Use the `Polls` class for server-side operations in your Convex functions:

```ts
import { Polls } from "convex-polls";
import { components } from "./_generated/api.js";

const polls = new Polls(components.convexPolls);
```

#### `polls.create(ctx, args): Promise<string>`

Create a new poll. Returns the poll ID.

```ts
const pollId = await polls.create(ctx, {
  title: "What's for lunch?",
  description: "Vote by noon",       // optional
  options: ["Pizza", "Sushi", "Tacos"],
  createdBy: userId,
  config: {                           // optional -- all fields have defaults
    allowMultipleVotes: false,        // default: false
    allowChangeVote: false,           // default: false
    showResultsBeforeVote: true,      // default: true
    closesAt: Date.now() + 3600000,   // optional: auto-close after 1 hour
    maxVotesPerUser: 2,               // optional: max options a user can select
  },
});
```

**Args:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | Yes | Poll question. Cannot be empty. |
| `description` | `string` | No | Additional context for the poll. |
| `options` | `string[]` | Yes | At least 2 options. No duplicates. No empty strings. |
| `createdBy` | `string` | Yes | Identifier for the poll creator. |
| `config` | `object` | No | Voting rules (see [Configuration Options](#configuration-options)). |

**Throws:**
- `"Poll title cannot be empty."` -- if title is blank
- `"A poll requires at least 2 options."` -- if fewer than 2 options
- `"Poll options cannot be empty."` -- if any option text is blank
- `"Duplicate option text is not allowed."` -- if options have duplicate text
- `"maxVotesPerUser must be at least 1."` -- if maxVotesPerUser < 1

#### `polls.get(ctx, pollId, voterId?): Promise<PollWithResults | null>`

Get a poll with computed results. Returns `null` if not found.

```ts
const poll = await polls.get(ctx, pollId, currentUserId);

poll.results[0].votes      // vote count for first option
poll.results[0].percentage // percentage of total votes
poll.totalVotes            // total votes across all options
poll.userVotes             // option IDs the current user voted for
```

**Returns `PollWithResults`:**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `string` | Poll document ID |
| `title` | `string` | Poll question |
| `description` | `string \| undefined` | Optional description |
| `options` | `PollOption[]` | Original options (`{ id, text }`) |
| `createdBy` | `string` | Creator identifier |
| `status` | `"active" \| "closed" \| "scheduled"` | Current status |
| `config` | `PollConfig` | Voting configuration |
| `createdAt` | `number` | Creation timestamp |
| `closedAt` | `number \| undefined` | When poll was closed |
| `results` | `PollOptionResult[]` | Computed results per option |
| `totalVotes` | `number` | Total votes across all options |
| `userVotes` | `string[]` | Option IDs the given voter voted for |

#### `polls.list(ctx, args?): Promise<PollListItem[]>`

List polls with optional filters.

```ts
const active = await polls.list(ctx, { status: "active" });
const mine = await polls.list(ctx, { createdBy: userId });
const recent = await polls.list(ctx, { limit: 10 });
```

**Args:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `"active" \| "closed" \| "scheduled"` | -- | Filter by status |
| `createdBy` | `string` | -- | Filter by creator |
| `limit` | `number` | `50` | Max results to return |

#### `polls.vote(ctx, args): Promise<null>`

Cast a vote on a poll.

```ts
await polls.vote(ctx, {
  pollId,
  optionId: "opt_0",
  voterId: userId,
});
```

**Throws:**
- `"Voter ID is required."` -- if voterId is empty
- `"Poll not found."` -- if poll doesn't exist
- `"This poll is closed and no longer accepting votes."` -- if poll is closed
- `"This poll has expired and is no longer accepting votes."` -- if past closesAt
- `"You have already voted on this poll."` -- if duplicate vote (single-vote mode)
- `"You have already voted for this option."` -- if duplicate option (multi-vote mode)
- `"You can only vote for up to N options on this poll."` -- if maxVotesPerUser exceeded

#### `polls.removeVote(ctx, args): Promise<null>`

Remove a vote from a poll.

```ts
await polls.removeVote(ctx, { pollId, optionId: "opt_0", voterId: userId });
```

**Throws:**
- `"Voter ID is required."` -- if voterId is empty
- `"Poll not found."` -- if poll doesn't exist
- `"Cannot remove votes from a closed poll."` -- if poll is closed
- `"No vote found for this option."` -- if no matching vote exists

#### `polls.close(ctx, pollId): Promise<null>`

Close a poll so no more votes are accepted.

```ts
await polls.close(ctx, pollId);
```

**Throws:**
- `"Poll not found."` -- if poll doesn't exist
- `"Poll is already closed."` -- if already closed

#### `polls.remove(ctx, pollId): Promise<null>`

Delete a poll and all its votes permanently.

```ts
await polls.remove(ctx, pollId);
```

#### `polls.getUserVotes(ctx, pollId, voterId): Promise<string[]>`

Get the option IDs a user voted for on a specific poll.

```ts
const optionIds = await polls.getUserVotes(ctx, pollId, userId);
// ["opt_0", "opt_2"]
```

### `createPollApi(component)`

Creates thin wrapper functions suitable for re-exporting from your `convex/` directory. These are the functions your React app calls via `useQuery` / `useMutation`.

```ts
import { createPollApi } from "convex-polls";
import { components } from "./_generated/api.js";

export const {
  create,     // mutation: create a poll
  get,        // query: get poll with results
  list,       // query: list polls
  castVote,   // mutation: cast a vote
  removeVote, // mutation: remove a vote
  close,      // mutation: close a poll
  remove,     // mutation: delete a poll
  getUserVotes, // query: get user's votes
} = createPollApi(components.convexPolls);
```

### React Hooks

#### `usePoll(api, pollId, voterId?)`

Subscribe to a single poll reactively. Returns live-updating vote counts and helper functions.

```tsx
import { usePoll } from "convex-polls/react";
import { api } from "../convex/_generated/api";

function MyPoll({ pollId }: { pollId: string }) {
  const { poll, isLoading, vote, removeVote, hasVoted, userVotes } = usePoll(
    api.polls,
    pollId,
    currentUserId,
  );

  if (isLoading) return <div>Loading...</div>;
  if (!poll) return <div>Poll not found</div>;

  return (
    <div>
      <h2>{poll.title}</h2>
      {poll.results.map((opt) => (
        <button
          key={opt.id}
          onClick={() => (userVotes.includes(opt.id) ? removeVote(opt.id) : vote(opt.id))}
          disabled={hasVoted && !userVotes.includes(opt.id)}
        >
          {userVotes.includes(opt.id) ? "✓ " : ""}
          {opt.text}: {opt.votes} ({opt.percentage.toFixed(0)}%)
        </button>
      ))}
    </div>
  );
}
```

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `poll` | `PollWithResults \| null \| undefined` | Poll data (`undefined` = loading) |
| `isLoading` | `boolean` | `true` while the query is loading |
| `vote` | `(optionId: string) => Promise<null>` | Cast a vote for the given option |
| `removeVote` | `(optionId: string) => Promise<null>` | Remove vote for the given option |
| `hasVoted` | `boolean` | Whether the voter has any votes on this poll |
| `userVotes` | `string[]` | Option IDs the voter has voted for |

#### `usePollList(api, args?)`

List polls reactively with optional filters.

```tsx
import { usePollList } from "convex-polls/react";

function ActivePolls() {
  const { polls, isLoading } = usePollList(api.polls, { status: "active" });

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {polls.map((p) => (
        <li key={p._id}>
          {p.title} ({p.totalVotes} votes)
        </li>
      ))}
    </ul>
  );
}
```

**Args:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `"active" \| "closed" \| "scheduled"` | -- | Filter by status |
| `createdBy` | `string` | -- | Filter by creator |
| `limit` | `number` | `50` | Max results |

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `polls` | `PollListItem[]` | List of polls (empty array while loading) |
| `isLoading` | `boolean` | `true` while the query is loading |

## Configuration Options

Set these when creating a poll via `config`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allowMultipleVotes` | `boolean` | `false` | Can a user vote for more than one option? |
| `allowChangeVote` | `boolean` | `false` | Can a user change their vote? (replaces previous vote) |
| `showResultsBeforeVote` | `boolean` | `true` | Show vote counts before the user has voted? |
| `closesAt` | `number` | -- | Unix timestamp (ms) to auto-close the poll |
| `maxVotesPerUser` | `number` | -- | Max options a user can select (requires `allowMultipleVotes: true`) |

## Exported Types

All types are exported from the main entry point:

```ts
import type {
  CreatePollArgs,
  PollOption,
  PollConfig,
  PollOptionResult,
  PollWithResults,
  PollListItem,
  ListPollsArgs,
  CastVoteArgs,
  RemoveVoteArgs,
} from "convex-polls";

import type { PollApi } from "convex-polls/react";
```

## Common Patterns

### Authenticated voting

```ts
// convex/myPolls.ts
import { mutation } from "./_generated/server.js";
import { Polls } from "convex-polls";
import { components } from "./_generated/api.js";
import { v } from "convex/values";

const polls = new Polls(components.convexPolls);

export const createPoll = mutation({
  args: { title: v.string(), options: v.array(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await polls.create(ctx, {
      ...args,
      createdBy: identity.subject,
    });
  },
});

export const vote = mutation({
  args: { pollId: v.string(), optionId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await polls.vote(ctx, {
      ...args,
      voterId: identity.subject,
    });
  },
});
```

### Anonymous voting

```ts
// Use a session ID as the voterId
const voterId = localStorage.getItem("poll_session") ?? crypto.randomUUID();
localStorage.setItem("poll_session", voterId);

const poll = useQuery(api.polls.get, { pollId, voterId });
```

### Auto-closing polls

```ts
await polls.create(ctx, {
  title: "Quick vote!",
  options: ["Yes", "No"],
  createdBy: userId,
  config: {
    closesAt: Date.now() + 60 * 60 * 1000, // closes in 1 hour
  },
});
```

### Hiding results until voting

```ts
await polls.create(ctx, {
  title: "Blind poll",
  options: ["A", "B", "C"],
  createdBy: userId,
  config: { showResultsBeforeVote: false },
});

// In your UI:
const showResults = poll.config.showResultsBeforeVote || hasVoted || isClosed;
```

### Multi-choice with limit

```ts
await polls.create(ctx, {
  title: "Pick your top 2",
  options: ["Alpha", "Beta", "Gamma", "Delta"],
  createdBy: userId,
  config: {
    allowMultipleVotes: true,
    maxVotesPerUser: 2,
  },
});
```

## Architecture

The component uses two tables:

- **polls** -- stores poll metadata, options, and configuration
- **votes** -- stores individual votes (one document per vote)

Vote counts are **computed at query time** by counting rows in the `votes` table, not stored on the poll document. This avoids write conflicts when multiple users vote simultaneously -- the key scalability feature.

Convex's reactivity means the `get` query automatically re-runs whenever votes change, so all subscribers see updated counts instantly with no polling or WebSocket plumbing.

## Development

```sh
npm install
npm run dev
```

This starts the Convex backend, the example frontend, and a watcher that rebuilds the component on changes.

```sh
npm test              # run tests
npm run test:watch    # watch mode
npm run test:coverage # coverage report
npm run build         # build the component
npm run typecheck     # type-check all code
```

## License

Apache-2.0
