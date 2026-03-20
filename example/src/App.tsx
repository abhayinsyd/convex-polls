import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import "./App.css";

// --- Constants ---

const DEMO_VOTER_ID = `voter_${Math.random().toString(36).slice(2, 8)}`;

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    let msg = error.message;
    while (msg.startsWith("Uncaught Error: ")) {
      msg = msg.slice("Uncaught Error: ".length);
    }
    const atNewline = msg.indexOf("\n    at ");
    if (atNewline !== -1) msg = msg.slice(0, atNewline);
    const atHandler = msg.indexOf(" at handler");
    if (atHandler !== -1) msg = msg.slice(0, atHandler);
    const atAsync = msg.indexOf(" at async");
    if (atAsync !== -1) msg = msg.slice(0, atAsync);
    return msg.trim();
  }
  return "Something went wrong. Please try again.";
}

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
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5" style={{ width: 340 }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast-enter card flex items-start gap-3 px-4 py-3.5"
            style={{
              borderLeft: `3px solid ${toast.type === "error" ? "var(--accent-pink)" : "var(--accent-lime)"}`,
            }}
          >
            <span className="mt-0.5 shrink-0">
              {toast.type === "error" ? (
                <svg className="w-4 h-4" style={{ color: "var(--accent-pink)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" style={{ color: "var(--accent-lime)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="flex-1 text-sm font-body" style={{ color: "var(--text-primary)" }}>
              {toast.message}
            </span>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
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

// --- Toggle ---

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer py-1.5">
      <span className="text-sm font-body" style={{ color: "var(--text-description)" }}>
        {label}
      </span>
      <div
        className={`toggle-switch ${checked ? "active" : ""}`}
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
      />
    </label>
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
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [allowChangeVote, setAllowChangeVote] = useState(false);
  const [showResultsBeforeVote, setShowResultsBeforeVote] = useState(true);

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
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showToast("Please enter a question for your poll", "error");
      return;
    }
    if (trimmedTitle.length > 500) {
      showToast("Question is too long (max 500 characters)", "error");
      return;
    }

    const validOptions = options.map((o) => o.trim()).filter((o) => o);
    if (validOptions.length < 2) {
      showToast("A poll needs at least 2 options", "error");
      return;
    }
    for (const opt of validOptions) {
      if (opt.length > 200) {
        showToast("Option text is too long (max 200 characters)", "error");
        return;
      }
    }
    const uniqueCheck = new Set(validOptions.map((o) => o.toLowerCase()));
    if (uniqueCheck.size !== validOptions.length) {
      showToast("Each option must be unique — you have duplicate options", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await createPoll({
        title: trimmedTitle,
        description: description.trim() || undefined,
        options: validOptions,
        createdBy: DEMO_VOTER_ID,
        config: {
          allowMultipleVotes,
          allowChangeVote,
          showResultsBeforeVote,
        },
      });
      setTitle("");
      setDescription("");
      setOptions(["", ""]);
      setAllowMultipleVotes(false);
      setAllowChangeVote(false);
      setShowResultsBeforeVote(true);
      showToast("Poll created!", "success");
      onCreated?.();
    } catch (e: unknown) {
      showToast(extractErrorMessage(e), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    !isSubmitting &&
    title.trim().length > 0 &&
    options.filter((o) => o.trim()).length >= 2;

  return (
    <form onSubmit={handleSubmit} className="card p-5">
      <div
        className="font-mono text-xs uppercase tracking-widest mb-5"
        style={{ color: "var(--text-secondary)", letterSpacing: "0.05em" }}
      >
        New Poll
      </div>

      <div className="space-y-4">
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to ask?"
            className="input-dark"
          />
        </div>

        <div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description (optional)"
            className="input-dark"
            style={{ fontSize: 13 }}
          />
        </div>

        <div>
          <div
            className="text-xs font-mono uppercase tracking-widest mb-2.5"
            style={{ color: "var(--text-secondary)" }}
          >
            Options
          </div>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2 group">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="input-dark flex-1"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "var(--accent-pink)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "var(--text-muted)")
                    }
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 10 && (
            <button
              type="button"
              onClick={addOption}
              className="mt-2.5 text-sm font-medium transition-colors"
              style={{ color: "var(--accent-orange)" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              + Add option
            </button>
          )}
        </div>

        {/* Config toggles */}
        <div
          className="pt-3"
          style={{ borderTop: "1px solid var(--surface-border)" }}
        >
          <div
            className="text-xs font-mono uppercase tracking-widest mb-3"
            style={{ color: "var(--text-secondary)" }}
          >
            Settings
          </div>
          <div className="space-y-1">
            <Toggle
              label="Allow multiple votes"
              checked={allowMultipleVotes}
              onChange={setAllowMultipleVotes}
            />
            <Toggle
              label="Allow vote change"
              checked={allowChangeVote}
              onChange={setAllowChangeVote}
            />
            <Toggle
              label="Show results before voting"
              checked={showResultsBeforeVote}
              onChange={setShowResultsBeforeVote}
            />
          </div>
        </div>

        <button type="submit" disabled={!canSubmit} className="btn-primary">
          {isSubmitting ? "Creating..." : "Create Poll"}
        </button>
      </div>
    </form>
  );
}

// --- PollCard ---

function PollCard({ pollId, index }: { pollId: string; index: number }) {
  const { showToast } = useToast();
  const poll = useQuery(api.example.get, { pollId, voterId: DEMO_VOTER_ID });
  const castVote = useMutation(api.example.castVote);
  const removeVoteMutation = useMutation(api.example.removeVote);
  const closePoll = useMutation(api.example.close);
  const removePoll = useMutation(api.example.remove);

  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const isSubmitting = submittingAction !== null;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [recentlyVoted, setRecentlyVoted] = useState<string | null>(null);
  const recentlyVotedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const prevTotalVotes = useRef<number | null>(null);
  const [voteCountFlash, setVoteCountFlash] = useState(false);

  // Flash vote count when it changes
  useEffect(() => {
    if (poll && prevTotalVotes.current !== null && prevTotalVotes.current !== poll.totalVotes) {
      setVoteCountFlash(true);
      const t = setTimeout(() => setVoteCountFlash(false), 600);
      return () => clearTimeout(t);
    }
    if (poll) prevTotalVotes.current = poll.totalVotes;
  }, [poll?.totalVotes]);

  if (poll === undefined) {
    return (
      <div className="card p-5">
        <div className="skeleton h-5 w-3/4 mb-4" />
        <div className="space-y-2.5">
          <div className="skeleton h-11" />
          <div className="skeleton h-11" />
          <div className="skeleton h-11" />
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

    setSubmittingAction("vote");
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
        if (recentlyVotedTimer.current)
          clearTimeout(recentlyVotedTimer.current);
        recentlyVotedTimer.current = setTimeout(
          () => setRecentlyVoted(null),
          1500,
        );
        showToast("Vote cast!", "success");
      }
    } catch (e: unknown) {
      showToast(extractErrorMessage(e), "error");
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleClose = async () => {
    if (isSubmitting) return;
    setSubmittingAction("close");
    try {
      await closePoll({ pollId });
      showToast("Poll closed", "success");
    } catch (e: unknown) {
      showToast(extractErrorMessage(e), "error");
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleRemove = async () => {
    if (isSubmitting) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setSubmittingAction("delete");
    try {
      await removePoll({ pollId });
      showToast("Poll deleted", "success");
    } catch (e: unknown) {
      showToast(extractErrorMessage(e), "error");
    } finally {
      setSubmittingAction(null);
      setConfirmingDelete(false);
    }
  };

  const maxVotes = Math.max(...poll.results.map((r) => r.votes), 1);

  return (
    <div
      className="card poll-card-enter overflow-hidden"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <h3
            className="font-heading text-lg font-bold leading-snug pr-3 min-w-0 break-words"
            style={{ color: "var(--text-primary)" }}
          >
            {poll.title}
          </h3>
          <div className="shrink-0">
            {!isClosed ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full text-xs font-medium font-mono"
                style={{
                  color: "#B8D623",
                  background: "rgba(184, 214, 35, 0.1)",
                  border: "1px solid rgba(184, 214, 35, 0.2)",
                  padding: "3px 10px",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                  style={{ background: "#B8D623" }}
                />
                Live
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-full text-xs font-medium font-mono"
                style={{
                  color: "var(--text-muted)",
                  background: "rgba(82, 82, 91, 0.15)",
                  border: "1px solid rgba(82, 82, 91, 0.2)",
                  padding: "3px 10px",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--text-muted)" }}
                />
                Closed
              </span>
            )}
          </div>
        </div>

        {poll.description && (
          <p
            className="text-sm mb-3"
            style={{ color: "var(--text-description)" }}
          >
            {poll.description}
          </p>
        )}

        {/* Voting hint */}
        {!isClosed &&
          hasVoted &&
          !poll.config.allowMultipleVotes &&
          poll.config.allowChangeVote && (
            <p
              className="text-xs mb-3 font-medium"
              style={{ color: "var(--accent-orange)" }}
            >
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
                className={`option-row ${isSelected ? "selected" : ""}`}
                style={{
                  borderColor: isRecentlyVoted
                    ? "rgba(255, 138, 20, 0.4)"
                    : isSelected
                      ? "rgba(255, 138, 20, 0.2)"
                      : undefined,
                  background: isRecentlyVoted
                    ? "rgba(255, 138, 20, 0.08)"
                    : undefined,
                }}
              >
                {/* Vote bar */}
                {showResults && (
                  <div
                    className={`vote-bar ${isClosed ? "vote-bar-closed" : isSelected ? "" : "vote-bar-unvoted"}`}
                    style={{ width: `${barWidth}%` }}
                  />
                )}

                {/* Content */}
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        width: 18,
                        height: 18,
                        borderColor: isSelected || isRecentlyVoted
                          ? "var(--accent-orange)"
                          : "var(--text-muted)",
                        background: isSelected || isRecentlyVoted
                          ? "var(--accent-orange)"
                          : "transparent",
                      }}
                    >
                      {(isSelected || isRecentlyVoted) && (
                        <svg
                          className="w-2.5 h-2.5 text-white"
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
                      className="text-sm font-medium"
                      style={{
                        color: isSelected
                          ? "var(--text-primary)"
                          : disabled
                            ? "var(--text-muted)"
                            : "var(--text-option)",
                      }}
                    >
                      {result.text}
                    </span>
                  </div>
                  {showResults && (
                    <span
                      className="text-xs font-mono tabular-nums ml-3"
                      style={{ color: "var(--text-vote-count)" }}
                    >
                      {result.votes}{" "}
                      <span style={{ color: "var(--text-vote-count)", opacity: 0.7 }}>
                        ({result.percentage.toFixed(0)}%)
                      </span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="mt-4 pt-3 flex items-center justify-between text-sm"
          style={{ borderTop: "1px solid var(--surface-border)" }}
        >
          <span
            className={`font-mono text-xs tabular-nums ${voteCountFlash ? "vote-count-flash" : ""}`}
            style={{ color: "var(--text-muted)" }}
          >
            {poll.totalVotes} vote{poll.totalVotes !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-3">
            {!isClosed && (
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="text-xs font-medium transition-colors disabled:opacity-50"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--text-primary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-muted)")
                }
              >
                {submittingAction === "close" ? "Closing..." : "Close"}
              </button>
            )}
            {confirmingDelete ? (
              <span className="inline-flex items-center gap-2">
                <span className="text-xs" style={{ color: "var(--accent-pink)" }}>
                  Delete?
                </span>
                <button
                  onClick={handleRemove}
                  disabled={isSubmitting}
                  className="text-xs font-medium transition-colors disabled:opacity-50"
                  style={{ color: "var(--accent-pink)" }}
                >
                  {submittingAction === "delete" ? "Deleting..." : "Yes"}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  disabled={isSubmitting}
                  className="text-xs font-medium transition-colors disabled:opacity-50"
                  style={{ color: "var(--text-muted)" }}
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={handleRemove}
                disabled={isSubmitting}
                className="text-xs font-medium transition-colors disabled:opacity-50"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--accent-pink)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-muted)")
                }
              >
                Delete
              </button>
            )}
            <span
              className="text-xs font-mono"
              style={{ color: "var(--text-muted)", opacity: 0.5 }}
            >
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
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-5 w-3/4 mb-4" />
            <div className="space-y-2.5">
              <div className="skeleton h-11" />
              <div className="skeleton h-11" />
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
      <div className="text-center py-20">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
          style={{ background: "rgba(255, 138, 20, 0.08)" }}
        >
          <svg
            className="w-7 h-7"
            style={{ color: "var(--accent-orange)", opacity: 0.6 }}
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
        <h3
          className="font-heading text-xl font-bold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          No polls yet
        </h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Create your first poll to see real-time voting in action
        </p>
        <div className="flex justify-center gap-1.5 mt-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-waiting-pulse"
              style={{
                background: "var(--accent-orange)",
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {activePolls.length > 0 && (
        <div>
          <h2
            className="text-xs font-mono uppercase tracking-widest mb-4"
            style={{ color: "var(--text-secondary)", letterSpacing: "0.05em" }}
          >
            Active Polls ({activePolls.length})
          </h2>
          <div className="flex flex-col gap-4">
            {activePolls.map((poll, i) => (
              <PollCard key={poll._id} pollId={poll._id} index={i} />
            ))}
          </div>
        </div>
      )}

      {closed.length > 0 && (
        <div>
          <h2
            className="text-xs font-mono uppercase tracking-widest mb-4"
            style={{ color: "var(--text-secondary)", letterSpacing: "0.05em" }}
          >
            Closed Polls ({closed.length})
          </h2>
          <div className="flex flex-col gap-4">
            {closed.map((poll, i) => (
              <PollCard key={poll._id} pollId={poll._id} index={i} />
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
      <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
        {/* Header */}
        <header
          className="sticky top-0 z-40"
          style={{
            height: 56,
            background: "rgba(10, 10, 11, 0.8)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--surface-border)",
          }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="font-heading text-base font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                convex-polls
              </span>
              <span
                className="hidden sm:inline text-xs font-body"
                style={{ color: "var(--text-secondary)" }}
              >
                Real-time polls and voting
              </span>
            </div>
            <div
              className="font-mono text-xs px-3 py-1.5 rounded-full"
              style={{
                color: "var(--text-secondary)",
                background: "var(--surface-border)",
              }}
            >
              {DEMO_VOTER_ID}
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 overflow-hidden">
          {/* Real-time hint */}
          <div
            className="card flex items-center gap-3 px-4 py-3 mb-6"
            style={{
              background: "rgba(99, 142, 255, 0.04)",
              borderColor: "rgba(99, 142, 255, 0.1)",
            }}
          >
            <svg
              className="w-4 h-4 shrink-0"
              style={{ color: "rgba(130, 160, 255, 0.6)" }}
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
            <span
              className="text-xs font-body"
              style={{ color: "rgba(160, 180, 255, 0.7)" }}
            >
              Open this page in another tab to see votes update in real-time
              across all clients
            </span>
          </div>

          {/* Layout: sidebar + content */}
          <div
            className="layout-grid grid gap-6"
            style={{ gridTemplateColumns: "340px 1fr" }}
          >
            {/* Sidebar - Create Poll */}
            <div
              className="self-start"
              style={{
                position: "sticky",
                top: 72,
              }}
            >
              <CreatePollForm />
            </div>

            {/* Content - Polls (scrolls independently) */}
            <div
              className="min-h-0"
              style={{
                maxHeight: "calc(100vh - 140px)",
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              <PollList />
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer
          className="py-6 mt-auto"
          style={{ borderTop: "1px solid var(--surface-border)" }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
            <span
              className="text-xs font-body"
              style={{ color: "var(--text-muted)" }}
            >
              Built with{" "}
              <a
                href="https://convex.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--text-primary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-secondary)")
                }
              >
                Convex
              </a>
            </span>
            <a
              href="https://github.com/get-convex/convex-components"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--text-secondary)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-muted)")
              }
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}

export default App;
