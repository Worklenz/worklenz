"use client";

export type SerializedTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  projectId: string;
  assigneeId: string | null;
  reviewComment: string | null;
  reviewOutcome: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  revisionCount: number;
  timeSpentMinute: number;
  plannedRate: number | null;
  actualRate: number | null;
  efficiency: number | null;
  variance: number | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; fullName: string | null; email: string } | null;
};

type Props = {
  task: SerializedTask;
  onClick: () => void;
};

export function TaskCard({ task, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={{
        background: "white",
        borderRadius: 6,
        padding: "10px 12px",
        border: "1px solid #f0f0f0",
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.15s"
      }}
      onMouseOver={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)")}
      onMouseOut={(e) => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)")}
    >
      <p style={{ margin: "0 0 6px 0", fontWeight: 500, fontSize: 14, color: "#262626", lineHeight: 1.4 }}>
        {task.title}
      </p>
      {task.description && (
        <p
          style={{
            margin: "0 0 6px 0",
            fontSize: 12,
            color: "#8c8c8c",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {task.description}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {task.assignee ? (
          <span
            style={{
              fontSize: 11,
              color: "#595959",
              background: "#f5f5f5",
              padding: "2px 6px",
              borderRadius: 10
            }}
          >
            {task.assignee.fullName ?? task.assignee.email}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "#bfbfbf" }}>Unassigned</span>
        )}
        {task.timeSpentMinute > 0 && (
          <span style={{ fontSize: 11, color: "#8c8c8c" }}>
            {Math.floor(task.timeSpentMinute / 60)}h {task.timeSpentMinute % 60}m
          </span>
        )}
      </div>
      {task.revisionCount > 0 && (
        <p style={{ margin: "6px 0 0 0", fontSize: 11, color: "#fa8c16" }}>
          {task.revisionCount} revision{task.revisionCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
