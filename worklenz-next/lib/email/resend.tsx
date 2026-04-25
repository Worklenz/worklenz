import { Resend } from "resend";
import { TaskReviewNotification } from "@/emails/task-review-notification";
import { DailyDigest } from "@/emails/daily-digest";
import { RevisionReminder } from "@/emails/revision-reminder";
import { ReviewPending } from "@/emails/review-pending";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "Prelim <noreply@prelim.app>";

type SendTaskReviewEmailInput = {
  to: string;
  recipientName: string;
  taskTitle: string;
  status: "approved" | "rejected" | "revision_required";
  comment?: string;
};

export async function sendTaskReviewEmail(input: SendTaskReviewEmailInput) {
  return resend.emails.send({
    from: FROM,
    to: [input.to],
    subject: `Task ${input.status.replace("_", " ")}: ${input.taskTitle}`,
    react: (
      <TaskReviewNotification
        recipientName={input.recipientName}
        taskTitle={input.taskTitle}
        status={input.status}
        comment={input.comment}
      />
    )
  });
}

type SendDailyDigestInput = {
  to: string;
  recipientName: string;
  date: string;
  absentCount: number;
  pendingReviewCount: number;
  absentStaff: { name: string; email: string }[];
};

export async function sendDailyDigestEmail(input: SendDailyDigestInput) {
  return resend.emails.send({
    from: FROM,
    to: [input.to],
    subject: `Prelim Daily Digest — ${input.date}`,
    react: (
      <DailyDigest
        recipientName={input.recipientName}
        date={input.date}
        absentCount={input.absentCount}
        pendingReviewCount={input.pendingReviewCount}
        absentStaff={input.absentStaff}
      />
    )
  });
}

type SendRevisionReminderInput = {
  to: string;
  recipientName: string;
  taskTitle: string;
  projectName: string;
  daysSinceRevision: number;
  reviewComment?: string;
};

export async function sendRevisionReminderEmail(input: SendRevisionReminderInput) {
  return resend.emails.send({
    from: FROM,
    to: [input.to],
    subject: `Action needed: ${input.taskTitle} awaiting revision`,
    react: (
      <RevisionReminder
        recipientName={input.recipientName}
        taskTitle={input.taskTitle}
        projectName={input.projectName}
        daysSinceRevision={input.daysSinceRevision}
        reviewComment={input.reviewComment}
      />
    )
  });
}

type PendingTask = {
  title: string;
  projectName: string;
  submittedHoursAgo: number;
  assigneeName: string;
};

type SendReviewPendingInput = {
  to: string;
  recipientName: string;
  pendingCount: number;
  tasks: PendingTask[];
};

export async function sendReviewPendingEmail(input: SendReviewPendingInput) {
  return resend.emails.send({
    from: FROM,
    to: [input.to],
    subject: `${input.pendingCount} task${input.pendingCount !== 1 ? "s" : ""} awaiting your review`,
    react: (
      <ReviewPending
        recipientName={input.recipientName}
        pendingCount={input.pendingCount}
        tasks={input.tasks}
      />
    )
  });
}
