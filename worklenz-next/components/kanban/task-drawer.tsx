"use client";

import { useState } from "react";
import type { SerializedTask } from "./task-card";

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Assigned",
  SUBMITTED: "Submitted",
  REVISION_REQUIRED: "Revision Required",
  ON_HOLD: "On Hold",
  APPROVED: "Approved",
  REJECTED: "Rejected"
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  ASSIGNED: { bg: "#e8f4fd", color: "#1890ff" },
  SUBMITTED: { bg: "#f0f5ff", color: "#2f54eb" },
  REVISION_REQUIRED: { bg: "#fff7e6", color: "#fa8c16" },
  ON_HOLD: { bg: "#f5f5f5", color: "#8c8c8c" },
  APPROVED: { bg: "#f6ffed", color: "#52c41a" },
  REJECTED: { bg: "#fff1f0", color: "#ff4d4f" }
};

type Props = {
  task: SerializedTask;
  onClose: () => void;
  onUpdate: (task: SerializedTask) => void;
};

export function TaskDrawer({ task, onClose, onUpdate }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colors = STATUS_COLORS[task.status] ?? { bg: "#f5f5f5", color: "#595959" };

  const handleSubmitForReview = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/jcc/tasks/${task.id}/submit`, { method: "POST" });
      const json = await res.json() as { error?: string; data?: SerializedTask };
      if (!res.ok) {
        setError(json.error ?? "Failed to submit");
        return;
      }
      if (json.data) onUpdate({ ...task, ...json.data });
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = task.status === "ASSIGNED" || task.status === "REVISION_REQUIRED";

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 100 }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          background: "white",
          zIndex: 101,
          overflowY: "auto",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, flex: 1, marginRight: 12 }}>
            {task.title}
          </h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "#8c8c8c",
              lineHeight: 1,
              padding: "4px 8px"
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Status">
            <span
              style={{
                background: colors.bg,
                color: colors.color,
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500
              }}
            >
              {STATUS_LABELS[task.status] ?? task.status}
            </span>
          </Field>

          <Field label="Assignee">
            {task.assignee ? (task.assignee.fullName ?? task.assignee.email) : "Unassigned"}
          </Field>

          {task.description && (
            <Field label="Description">
              <span style={{ whiteSpace: "pre-wrap", color: "#595959" }}>{task.description}</span>
            </Field>
          )}

          <Field label="Time Logged">
            {task.timeSpentMinute > 0
              ? `${Math.floor(task.timeSpentMinute / 60)}h ${task.timeSpentMinute % 60}m`
              : "No time logged"}
          </Field>

          {task.revisionCount > 0 && (
            <Field label="Revisions">{task.revisionCount}</Field>
          )}

          {task.submittedAt && (
            <Field label="Submitted">
              {new Date(task.submittedAt).toLocaleString()}
            </Field>
          )}

          {task.reviewComment && (
            <Field label="Review Comment">
              <span
                style={{
                  display: "block",
                  padding: "8px 12px",
                  background: "#f8f8f8",
                  borderRadius: 6,
                  fontSize: 14,
                  color: "#595959"
                }}
              >
                {task.reviewComment}
              </span>
            </Field>
          )}

          {error && (
            <p
              style={{
                color: "#ff4d4f",
                fontSize: 13,
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
        </div>

        {/* Footer */}
        {canSubmit && (
          <div style={{ padding: 20, borderTop: "1px solid #f0f0f0" }}>
            <button
              onClick={handleSubmitForReview}
              disabled={submitting}
              style={{
                width: "100%",
                padding: "10px 16px",
                background: submitting ? "#d9d9d9" : "#1890ff",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: submitting ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 500
              }}
            >
              {submitting ? "Submitting..." : "Submit for Review"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        style={{
          margin: "0 0 4px 0",
          fontSize: 12,
          color: "#8c8c8c",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.05em"
        }}
      >
        {label}
      </p>
      <div style={{ fontSize: 14 }}>{children}</div>
    </div>
  );
}
