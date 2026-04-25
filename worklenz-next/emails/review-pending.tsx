import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

type ReviewPendingProps = {
  recipientName: string;
  pendingCount: number;
  tasks: { title: string; projectName: string; submittedHoursAgo: number; assigneeName: string }[];
};

export function ReviewPending({ recipientName, pendingCount, tasks }: ReviewPendingProps) {
  return (
    <Html>
      <Head />
      <Preview>{pendingCount} task{pendingCount !== 1 ? "s" : ""} awaiting your review</Preview>
      <Body style={{ backgroundColor: "#f8fafc", fontFamily: "Arial, sans-serif" }}>
        <Container
          style={{
            maxWidth: "560px",
            margin: "24px auto",
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "24px",
            border: "1px solid #e2e8f0"
          }}
        >
          <Heading style={{ marginTop: 0 }}>Review Queue Reminder</Heading>
          <Text>Hi {recipientName},</Text>
          <Text>
            You have <strong>{pendingCount} task{pendingCount !== 1 ? "s" : ""}</strong> awaiting
            review. The following have been pending for more than 24 hours:
          </Text>

          {tasks.map((task, i) => (
            <Section
              key={i}
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                padding: "12px",
                marginBottom: 8
              }}
            >
              <Text style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{task.title}</Text>
              <Text style={{ margin: "4px 0 0", fontSize: 13, color: "#8c8c8c" }}>
                {task.projectName} · {task.assigneeName} · submitted {task.submittedHoursAgo}h ago
              </Text>
            </Section>
          ))}

          <Text style={{ marginBottom: 0, marginTop: 24, color: "#8c8c8c", fontSize: 12 }}>
            Prelim — automated review reminder
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
