import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

// --- Constants ---

const DEMO_VOTER_ID = `voter_${Math.random().toString(36).slice(2, 8)}`;

// --- Toast System ---

type ToastType = "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

function useToast() {
  return useContext(ToastContext);
}

let nextToastId = 0;

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = "error") => {
      const id = ++nextToastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-slide-in ${
              toast.type === "error" ? "bg-red-600" : "bg-emerald-600"
            }`}
          >
            <span className="mt-0.5 shrink-0">
              {toast.type === "error" ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/70 hover:text-white shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// --- CreatePollForm ---

function CreatePollForm({ onCreated }: { onCreated?: () => void }) {
  const { showToast } = useToast();
  const createPoll = useMutation(api.example.create);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addOption = () => {
    if (options.length < 10) setOptions([...options, ""]);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter((o) => o.trim());
    if (!title.trim() || validOptions.length < 2) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createPoll({
        title: title.trim(),
        description: description.trim() || undefined,
        options: validOptions,
        createdBy: DEMO_VOTER_ID,
      });
      setTitle("");
      setDescription("");
      setOptions(["", ""]);
      showToast("Poll created!", "success");
      onCreated?.();
    } catch (e: unknown) {
      showToast(
        e instanceof Error ? e.message : "Failed to create poll",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Create a Poll
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Question
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to ask?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-poll-500 focus:border-transparent outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add more context..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-poll-500 focus:border-transparent outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Options
          </label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-poll-500 focus:border-transparent outline-none transition"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="px-3 py-2 text-gray-400 hover:text-red-500 transition"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 10 && (
            <button
              type="button"
              onClick={addOption}
              className="mt-2 text-sm text-poll-600 hover:text-poll-700 font-medium transition"
            >
              + Add option
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={
            isSubmitting ||
            !title.trim() ||
            options.filter((o) => o.trim()).length < 2
          }
          className="w-full py-2.5 px-4 bg-poll-600 text-white font-medium rounded-lg hover:bg-poll-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? "Creating..." : "Create Poll"}
        </button>
      </div>
    </form>
  );
}

// --- PollCard ---

function PollCard({ pollId }: { pollId: string }) {
  const { showToast } = useToast();
  const poll = useQuery(api.example.get, { pollId, voterId: DEMO_VOTER_ID });
  const castVote = useMutation(api.example.castVote);
  const removeVoteMutation = useMutation(api.example.removeVote);
  const closePoll = useMutation(api.example.close);
  const removePoll = useMutation(api.example.remove);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentlyVoted, setRecentlyVoted] = useState<string | null>(null);
  const recentlyVotedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (poll === undefined) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-3/4 mb-4" />
        <div className="space-y-3">
          <div className="h-12 bg-gray-100 rounded-lg" />
          <div className="h-12 bg-gray-100 rounded-lg" />
          <div className="h-12 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (poll === null) return null;

  const hasVoted = poll.userVotes.length > 0;
  const isClosed =
    poll.status === "closed" ||
    (poll.config.closesAt != null && Date.now() > poll.config.closesAt);
  const showResults =
    isClosed || hasVoted || poll.config.showResultsBeforeVote;

  const canClickOption = (optionId: string): boolean => {
    if (isClosed || isSubmitting) return false;
    const isSelected = poll.userVotes.includes(optionId);
    if (isSelected) return true;
    if (!hasVoted) return true;
    if (poll.config.allowMultipleVotes) return true;
    if (poll.config.allowChangeVote) return true;
    return false;
  };

  const handleVote = async (optionId: string) => {
    if (isSubmitting || isClosed) return;
    const isSelected = poll.userVotes.includes(optionId);

    setIsSubmitting(true);
    try {
      if (isSelected) {
        await removeVoteMutation({
          pollId,
          optionId,
          voterId: DEMO_VOTER_ID,
        });
        showToast("Vote removed", "success");
      } else {
        await castVote({ pollId, optionId, voterId: DEMO_VOTER_ID });
        setRecentlyVoted(optionId);
        if (recentlyVotedTimer.current) clearTimeout(recentlyVotedTimer.current);
        recentlyVotedTimer.current = setTimeout(
          () => setRecentlyVoted(null),
          1500,
        );
        showToast("Vote cast!", "success");
      }
    } catch (e: unknown) {
      showToast(
        e instanceof Error ? e.message : "Failed to vote",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await closePoll({ pollId });
      showToast("Poll closed", "success");
    } catch (e: unknown) {
      showToast(
        e instanceof Error ? e.message : "Failed to close poll",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await removePoll({ pollId });
      showToast("Poll deleted", "success");
    } catch (e: unknown) {
      showToast(
        e instanceof Error ? e.message : "Failed to delete poll",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const maxVotes = Math.max(...poll.results.map((r) => r.votes), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-semibold text-gray-900 leading-snug pr-3 min-w-0 break-words">
            {poll.title}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {!isClosed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                Live
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                Closed
              </span>
            )}
          </div>
        </div>
        {poll.description && (
          <p className="text-sm text-gray-500 mb-3">{poll.description}</p>
        )}

        {/* Voting hints */}
        {!isClosed &&
          hasVoted &&
          !poll.config.allowMultipleVotes &&
          poll.config.allowChangeVote && (
            <p className="text-xs text-poll-600 mb-3 font-medium">
              Click another option to change your vote
            </p>
          )}

        {/* Options */}
        <div className="space-y-2 mt-3">
          {poll.results.map((result) => {
            const isSelected = poll.userVotes.includes(result.id);
            const isRecentlyVoted = recentlyVoted === result.id;
            const disabled = !canClickOption(result.id);
            const barWidth = showResults
              ? poll.totalVotes > 0
                ? (result.votes / maxVotes) * 100
                : 0
              : 0;

            return (
              <button
                key={result.id}
                onClick={() => handleVote(result.id)}
                disabled={disabled}
                className={`relative w-full text-left px-4 py-3 rounded-lg border-2 transition-all duration-200 break-words ${
                  isRecentlyVoted
                    ? "border-emerald-400 bg-emerald-50"
                    : isSelected
                      ? "border-poll-500 bg-poll-50"
                      : disabled
                        ? "border-gray-200 bg-gray-50/80 cursor-default"
                        : "border-gray-200 hover:border-poll-300 hover:bg-poll-50/50 cursor-pointer"
                }`}
              >
                {/* Vote bar */}
                {showResults && (
                  <div
                    className={`absolute inset-y-0 left-0 rounded-lg transition-all duration-500 ease-out ${
                      isRecentlyVoted
                        ? "bg-emerald-100/60"
                        : isSelected
                          ? "bg-poll-100/60"
                          : "bg-gray-100/60"
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                )}

                {/* Content */}
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isRecentlyVoted
                          ? "border-emerald-500 bg-emerald-500"
                          : isSelected
                            ? "border-poll-500 bg-poll-500"
                            : "border-gray-300"
                      }`}
                    >
                      {(isSelected || isRecentlyVoted) && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isSelected
                          ? "text-poll-700"
                          : disabled
                            ? "text-gray-400"
                            : "text-gray-700"
                      }`}
                    >
                      {result.text}
                    </span>
                  </div>
                  {showResults && (
                    <span className="text-sm font-semibold text-gray-600 tabular-nums ml-3">
                      {result.votes} ({result.percentage.toFixed(0)}%)
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span className="tabular-nums">
            {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-3">
            {!isClosed && (
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="text-gray-400 hover:text-orange-500 font-medium transition disabled:opacity-50"
              >
                Close
              </button>
            )}
            <button
              onClick={handleRemove}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-red-500 font-medium transition disabled:opacity-50"
            >
              Delete
            </button>
            <span className="text-gray-300">|</span>
            <span className="text-gray-400">
              {new Date(poll.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- PollList ---

function PollList() {
  const polls = useQuery(api.example.list, { status: "active" });
  const closedPolls = useQuery(api.example.list, { status: "closed" });

  if (polls === undefined) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse"
          >
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="space-y-3">
              <div className="h-12 bg-gray-100 rounded-lg" />
              <div className="h-12 bg-gray-100 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const activePolls = polls ?? [];
  const closed = closedPolls ?? [];

  if (activePolls.length === 0 && closed.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-poll-50 mb-4">
          <svg
            className="w-8 h-8 text-poll-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          No polls yet
        </h3>
        <p className="text-sm text-gray-500">
          Create your first poll above to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {activePolls.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Active Polls ({activePolls.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activePolls.map((poll) => (
              <PollCard key={poll._id} pollId={poll._id} />
            ))}
          </div>
        </div>
      )}

      {closed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Closed Polls ({closed.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {closed.map((poll) => (
              <PollCard key={poll._id} pollId={poll._id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- App ---

function App() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-poll-100 text-xl">
                  &#x1f5f3;
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    convex-polls
                  </h1>
                  <p className="text-sm text-gray-500">
                    Real-time polls and voting &mdash; powered by Convex
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
                <span className="bg-gray-100 px-2.5 py-1 rounded-md font-mono">
                  {DEMO_VOTER_ID}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-poll-50 border border-poll-100 rounded-lg px-4 py-2.5">
            <svg
              className="w-4 h-4 text-poll-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              Open this page in another tab to see votes update in real-time
              across all clients.
            </span>
          </div>

          <div className="max-w-xl">
            <CreatePollForm />
          </div>

          <PollList />
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;
