import { requireOneOfRoles } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { ReviewQueueClient, type ReviewTask } from "@/components/review/review-queue-client";

export default async function ReviewQueuePage() {
  await requireOneOfRoles(["owner", "admin", "managing_director", "senior_qs"]);

  const rawTasks = await prisma.task.findMany({
    where: { status: { in: ["SUBMITTED", "Submitted", "submitted"] } },
    include: {
      project: { select: { id: true, name: true, code: true } },
      assignee: { select: { id: true, fullName: true, email: true } }
    },
    orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }]
  });

  const tasks: ReviewTask[] = rawTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    revisionCount: t.revisionCount,
    submittedAt: t.submittedAt?.toISOString() ?? null,
    reviewComment: t.reviewComment,
    project: t.project,
    assignee: t.assignee
  }));

  return (
    <section>
      <h1 style={{ marginTop: 0, fontSize: 22 }}>Review Queue</h1>
      <p style={{ color: "#8c8c8c", marginBottom: 24, marginTop: 0 }}>
        {tasks.length} task{tasks.length !== 1 ? "s" : ""} awaiting review
      </p>
      <ReviewQueueClient initialTasks={tasks} />
    </section>
  );
}
