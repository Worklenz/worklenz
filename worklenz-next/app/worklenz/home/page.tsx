import { requireUserProfile } from "@/lib/users/profile";
import { prisma } from "@/lib/db/prisma";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  ASSIGNED: { bg: "#e8f4fd", color: "#1890ff" },
  SUBMITTED: { bg: "#f0f5ff", color: "#2f54eb" },
  REVISION_REQUIRED: { bg: "#fff7e6", color: "#fa8c16" },
  ON_HOLD: { bg: "#f5f5f5", color: "#8c8c8c" },
  APPROVED: { bg: "#f6ffed", color: "#52c41a" },
  REJECTED: { bg: "#fff1f0", color: "#ff4d4f" }
};

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Assigned",
  SUBMITTED: "Submitted",
  REVISION_REQUIRED: "Revision Required",
  ON_HOLD: "On Hold",
  APPROVED: "Approved",
  REJECTED: "Rejected"
};

const ATTENDANCE_COLORS: Record<string, string> = {
  present: "#52c41a",
  half_day: "#fa8c16",
  on_leave: "#2f54eb",
  absent: "#ff4d4f"
};

export default async function HomePage() {
  const profile = await requireUserProfile();
  if (!profile) return null;

  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const [myTasksCount, submittedCount, projectsCount, attendanceToday, recentTasks] =
    await Promise.all([
      prisma.task.count({
        where: {
          assigneeId: profile.id,
          status: { in: ["ASSIGNED", "REVISION_REQUIRED", "ON_HOLD"] }
        }
      }),
      prisma.task.count({ where: { status: "SUBMITTED" } }),
      prisma.project.count(),
      prisma.attendance.findFirst({
        where: { userId: profile.id, workDate: { gte: today, lt: tomorrow } }
      }),
      prisma.task.findMany({
        where: { assigneeId: profile.id },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: { project: { select: { id: true, name: true, code: true } } }
      })
    ]);

  const attendanceColor = attendanceToday
    ? (ATTENDANCE_COLORS[attendanceToday.status] ?? "#52c41a")
    : "#ff4d4f";

  return (
    <section>
      <h1 style={{ marginTop: 0, fontSize: 22 }}>Home</h1>
      <p style={{ marginBottom: 24, color: "#8c8c8c", marginTop: 0 }}>
        Welcome back, {profile.fullName ?? profile.email}
      </p>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32
        }}
      >
        <StatCard label="My Open Tasks" value={myTasksCount} color="#1890ff" />
        <StatCard label="Pending Review" value={submittedCount} color="#fa8c16" />
        <StatCard label="Projects" value={projectsCount} color="#52c41a" />
        <StatCard
          label="Today's Attendance"
          value={attendanceToday?.status ?? "Not logged"}
          color={attendanceColor}
        />
      </div>

      {/* Recent Tasks */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>My Recent Tasks</h2>
      {recentTasks.length === 0 ? (
        <p style={{ color: "#8c8c8c" }}>No tasks assigned yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recentTasks.map((task) => {
            const c = STATUS_COLORS[task.status] ?? { bg: "#f5f5f5", color: "#595959" };
            return (
              <div
                key={task.id}
                style={{
                  background: "white",
                  border: "1px solid #f0f0f0",
                  borderRadius: 8,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>{task.title}</p>
                  <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#8c8c8c" }}>
                    {task.project.name} · {task.project.code}
                  </p>
                </div>
                <span
                  style={{
                    background: c.bg,
                    color: c.color,
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    whiteSpace: "nowrap"
                  }}
                >
                  {STATUS_LABELS[task.status] ?? task.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  color
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #f0f0f0",
        borderRadius: 8,
        padding: "16px 20px",
        borderLeft: `4px solid ${color}`
      }}
    >
      <p
        style={{
          margin: "0 0 4px 0",
          fontSize: 12,
          color: "#8c8c8c",
          textTransform: "uppercase",
          letterSpacing: "0.05em"
        }}
      >
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}
