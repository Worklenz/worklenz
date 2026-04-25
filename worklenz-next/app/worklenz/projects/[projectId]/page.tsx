import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserProfile } from "@/lib/users/profile";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import type { SerializedTask } from "@/components/kanban/task-card";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  await requireUserProfile();
  const { projectId } = await params;

  const [project, rawTasks] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.task.findMany({
      where: { projectId },
      include: { assignee: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);

  if (!project) notFound();

  const tasks: SerializedTask[] = rawTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    projectId: t.projectId,
    assigneeId: t.assigneeId,
    reviewComment: t.reviewComment,
    reviewOutcome: t.reviewOutcome,
    submittedAt: t.submittedAt?.toISOString() ?? null,
    reviewedAt: t.reviewedAt?.toISOString() ?? null,
    revisionCount: t.revisionCount,
    timeSpentMinute: t.timeSpentMinute,
    plannedRate: t.plannedRate,
    actualRate: t.actualRate,
    efficiency: t.efficiency,
    variance: t.variance,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    assignee: t.assignee
  }));

  return (
    <KanbanBoard
      projectId={projectId}
      projectName={project.name}
      initialTasks={tasks}
    />
  );
}
