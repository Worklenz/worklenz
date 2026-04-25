"use client";

import { useState } from "react";

export type ReviewTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  revisionCount: number;
  submittedAt: string | null;
  reviewComment: string | null;
  project: { id: string; name: string; code: string };
  assignee: { id: string; fullName: string | null; email: string } | null;
};

const OUTCOMES = [
  { value: "approved", label: "Approve", color: "#52c41a" },
  { value: "revision_required", label: "Revision Required", color: "#fa8c16" },
  { value: "rejected", label: "Reject", color: "#ff4d4f" },
  { value: "on_hold", label: "On Hold", color: "#8c8c8c" }
];

type Props = {
  initialTasks: ReviewTask[];
};

export function ReviewQueueClient({ initialTasks }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selected, setSelected] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <p style={{ color: "#8c8c8c", padding: "40px 0", textAlign: "center" }}>
        No tasks in queue.
      </p>
    );
  }

  const handleReview = async (taskId: string, outcome: string) => {
    if (outcome === "rejected" && !comment.trim()) {
      setError("Comment required for rejection");
      return;
    }
    setReviewing(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/jcc/tasks/${taskId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, comment: comment.trim() || undefined })
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Review failed");
        return;
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSelected(null);
      setComment("");
    } catch {
      setError("Network error");
    } finally {
      setReviewing(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error && (
        <p
          style={{
            color: "#ff4d4f",
            padding: "8px 12px",
            background: "#fff1f0",
            borderRadius: 6,
            border: "1px solid #ffa39e",
            margin: 0
          }}
        >
          {error}
        </p>
      )}

      {tasks.map((task) => (
        <div
          key={task.id}
          style={{
            background: "white",
            border: "1px solid #f0f0f0",
            borderRadius: 8,
            padding: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12
            }}
          >
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 4px 0", fontWeight: 600, fontSize: 15 }}>{task.title}</p>
              <p style={{ margin: 0, fontSize: 13, color: "#8c8c8c" }}>
                {task.project.name} ({task.project.code}) ·{" "}
                {task.assignee
                  ? (task.assignee.fullName ?? task.assignee.email)
                  : "Unassigned"}{" "}
                ·{" "}
                {task.submittedAt
                  ? `Submitted ${new Date(task.submittedAt).toLocaleDateString()}`
                  : "Unknown date"}
              </p>
              {task.revisionCount > 0 && (
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#fa8c16" }}>
                  {task.revisionCount} revision{task.revisionCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setSelected(selected === task.id ? null : task.id);
                setError(null);
                setComment("");
              }}
              style={{
                padding: "6px 12px",
                border: "1px solid #d9d9d9",
                borderRadius: 6,
                cursor: "pointer",
                background: "white",
                fontSize: 13,
                whiteSpace: "nowrap"
              }}
            >
              {selected === task.id ? "Cancel" : "Review"}
            </button>
          </div>

          {selected === task.id && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid #f0f0f0"
              }}
            >
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Comment (required for rejection)…"
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid #d9d9d9",
                  borderRadius: 6,
                  fontSize: 13,
                  resize: "vertical",
                  marginBottom: 10
                }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {OUTCOMES.map((outcome) => (
                  <button
                    key={outcome.value}
                    onClick={() => handleReview(task.id, outcome.value)}
                    disabled={reviewing === task.id}
                    style={{
                      padding: "6px 14px",
                      background: reviewing === task.id ? "#d9d9d9" : outcome.color,
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: reviewing === task.id ? "not-allowed" : "pointer",
                      fontSize: 13,
                      fontWeight: 500
                    }}
                  >
                    {outcome.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
