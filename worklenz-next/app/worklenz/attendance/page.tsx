import { requireUserProfile } from "@/lib/users/profile";
import { prisma } from "@/lib/db/prisma";
import { AttendanceForm } from "@/components/attendance/attendance-form";

const ATTENDANCE_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  present: { bg: "#f6ffed", color: "#52c41a", label: "Present" },
  absent: { bg: "#fff1f0", color: "#ff4d4f", label: "Absent" },
  half_day: { bg: "#fff7e6", color: "#fa8c16", label: "Half Day" },
  on_leave: { bg: "#f0f5ff", color: "#2f54eb", label: "On Leave" }
};

export default async function AttendancePage() {
  const profile = await requireUserProfile();
  if (!profile) return null;

  const records = await prisma.attendance.findMany({
    where: { userId: profile.id },
    orderBy: { workDate: "desc" },
    take: 30,
    include: { office: { select: { name: true, code: true } } }
  });

  return (
    <section>
      <h1 style={{ marginTop: 0, fontSize: 22 }}>Attendance</h1>

      <AttendanceForm />

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Recent Records</h2>
      {records.length === 0 ? (
        <p style={{ color: "#8c8c8c" }}>No attendance records yet.</p>
      ) : (
        <div
          style={{
            background: "white",
            border: "1px solid #f0f0f0",
            borderRadius: 8,
            overflow: "hidden"
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "2px solid #f0f0f0" }}>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th>Check-in</Th>
                <Th>Office</Th>
                <Th>Reason</Th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => {
                const badge = ATTENDANCE_BADGES[rec.status] ?? {
                  bg: "#f5f5f5",
                  color: "#595959",
                  label: rec.status
                };
                return (
                  <tr key={rec.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <Td>{rec.workDate.toISOString().slice(0, 10)}</Td>
                    <Td>
                      <span
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500
                        }}
                      >
                        {badge.label}
                      </span>
                    </Td>
                    <Td>{rec.checkInTime.toISOString().slice(11, 16)}</Td>
                    <Td>{rec.office?.name ?? "—"}</Td>
                    <Td>{rec.reason ?? "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 16px",
        fontSize: 12,
        color: "#8c8c8c",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em"
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "10px 16px", fontSize: 14, color: "#262626" }}>{children}</td>
  );
}
