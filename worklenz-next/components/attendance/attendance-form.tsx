"use client";

import { useState } from "react";

const STATUSES = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half Day" },
  { value: "on_leave", label: "On Leave" }
];

export function AttendanceForm() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("present");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendance_date: date,
          status,
          reason: reason.trim() || undefined
        })
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to log attendance");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const needsReason = status === "absent" || status === "on_leave";

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #f0f0f0",
        borderRadius: 8,
        padding: 20,
        marginBottom: 24,
        maxWidth: 480
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: 16, fontWeight: 600 }}>Log Attendance</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: "#8c8c8c", fontWeight: 500, display: "block", marginBottom: 4 }}>
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              display: "block",
              padding: "7px 10px",
              border: "1px solid #d9d9d9",
              borderRadius: 6,
              fontSize: 14,
              width: "100%"
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: "#8c8c8c", fontWeight: 500, display: "block", marginBottom: 4 }}>
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              display: "block",
              padding: "7px 10px",
              border: "1px solid #d9d9d9",
              borderRadius: 6,
              fontSize: 14,
              width: "100%"
            }}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {needsReason && (
          <div>
            <label style={{ fontSize: 12, color: "#8c8c8c", fontWeight: 500, display: "block", marginBottom: 4 }}>
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional reason…"
              rows={2}
              style={{
                display: "block",
                padding: "7px 10px",
                border: "1px solid #d9d9d9",
                borderRadius: 6,
                fontSize: 14,
                width: "100%",
                resize: "vertical"
              }}
            />
          </div>
        )}

        {success && (
          <p style={{ color: "#52c41a", fontSize: 13, margin: 0 }}>Attendance logged successfully.</p>
        )}
        {error && <p style={{ color: "#ff4d4f", fontSize: 13, margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "8px 16px",
            background: submitting ? "#d9d9d9" : "#1890ff",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: submitting ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 500
          }}
        >
          {submitting ? "Saving…" : "Log Attendance"}
        </button>
      </form>
    </div>
  );
}
