"use client";

import { useState, useCallback } from "react";
import { TaskCard, type SerializedTask } from "./task-card";
import { TaskDrawer } from "./task-drawer";

const STATUS_COLUMNS = [
  { key: "ASSIGNED", label: "Assigned", borderColor: "#1890ff", bgColor: "#e8f4fd" },
  { key: "REVISION_REQUIRED", label: "Revision Required", borderColor: "#fa8c16", bgColor: "#fff7e6" },
  { key: "ON_HOLD", label: "On Hold", borderColor: "#8c8c8c", bgColor: "#f5f5f5" },
  { key: "SUBMITTED", label: "Submitted", borderColor: "#2f54eb", bgColor: "#f0f5ff" },
  { key: "APPROVED", label: "Approved", borderColor: "#52c41a", bgColor: "#f6ffed" },
  { key: "REJECTED", label: "Rejected", borderColor: "#ff4d4f", bgColor: "#fff1f0" }
];

type Props = {
  projectId: string;
  projectName: string;
  initialTasks: SerializedTask[];
};

export function KanbanBoard({ projectId, projectName, initialTasks }: Props) {
  const [tasks, setTasks] = useState<SerializedTask[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<SerializedTask | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const tasksByStatus = STATUS_COLUMNS.reduce<Record<string, SerializedTask[]>>((acc, col) => {
    acc[col.key] = tasks.filter((t) => t.status === col.key);
    return acc;
  }, {});

  const handleTaskUpdate = useCallback((updated: SerializedTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTask(updated);
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() })
      });
      const json = await res.json() as { error?: string; data?: SerializedTask };
      if (!res.ok) {
        setCreateError(json.error ?? "Failed to create task");
        return;
      }
      if (json.data) {
        setTasks((prev) => [{ ...json.data!, assignee: null }, ...prev]);
        setNewTitle("");
        setShowCreate(false);
      }
    } catch {
      setCreateError("Network error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{projectName}</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          style={{
            padding: "8px 16px",
            background: "#1890ff",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500
          }}
        >
          + New Task
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreateTask} style={{ marginBottom: 20, display: "flex", gap: 8 }}>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task title…"
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #d9d9d9",
              borderRadius: 6,
              fontSize: 14
            }}
          />
          <button
            type="submit"
            disabled={creating}
            style={{
              padding: "8px 16px",
              background: creating ? "#d9d9d9" : "#52c41a",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: creating ? "not-allowed" : "pointer"
            }}
          >
            {creating ? "Creating…" : "Create"}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(false)}
            style={{
              padding: "8px 16px",
              background: "#f5f5f5",
              border: "1px solid #d9d9d9",
              borderRadius: 6,
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
        </form>
      )}
      {createError && (
        <p style={{ color: "#ff4d4f", fontSize: 13, marginBottom: 12 }}>{createError}</p>
      )}

      {/* Board */}
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16 }}>
        {STATUS_COLUMNS.map((col) => (
          <div
            key={col.key}
            style={{
              minWidth: 270,
              maxWidth: 270,
              flexShrink: 0,
              background: col.bgColor,
              borderRadius: 8,
              borderTop: `3px solid ${col.borderColor}`,
              border: `1px solid ${col.borderColor}22`,
              borderTopColor: col.borderColor,
              padding: "12px"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13, color: "#595959" }}>{col.label}</span>
              <span
                style={{
                  background: col.borderColor,
                  color: "white",
                  borderRadius: 10,
                  padding: "1px 8px",
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                {tasksByStatus[col.key]?.length ?? 0}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(tasksByStatus[col.key] ?? []).map((task) => (
                <TaskCard key={task.id} task={task} onClick={() => setSelectedTask(task)} />
              ))}
              {(tasksByStatus[col.key] ?? []).length === 0 && (
                <p style={{ textAlign: "center", color: "#bfbfbf", fontSize: 13, padding: "20px 0", margin: 0 }}>
                  No tasks
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Task Drawer */}
      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
        />
      )}
    </div>
  );
}
