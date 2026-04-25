import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

type RevisionReminderProps = {
  recipientName: string;
  taskTitle: string;
  projectName: string;
  daysSinceRevision: number;
  reviewComment?: string;
};

export function RevisionReminder({
  recipientName,
  taskTitle,
  projectName,
  daysSinceRevision,
  reviewComment
}: RevisionReminderProps) {
  return (
    <Html>
      <Head />
      <Preview>Action needed: {taskTitle} has been in revision for {daysSinceRevision} days</Preview>
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
          <Heading style={{ marginTop: 0, color: "#fa8c16" }}>Revision Reminder</Heading>
          <Text>Hi {recipientName},</Text>
          <Text>
            Your task <strong>{taskTitle}</strong> in project <strong>{projectName}</strong> has been
            awaiting revision for <strong>{daysSinceRevision} days</strong>. Please address the
            review comments and resubmit.
          </Text>

          {reviewComment && (
            <Section
              style={{
                backgroundColor: "#fff7e6",
                borderRadius: "8px",
                border: "1px solid #ffd591",
                padding: "12px"
              }}
            >
              <Text style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Review Comment:
              </Text>
              <Text style={{ margin: 0, fontSize: 14 }}>{reviewComment}</Text>
            </Section>
          )}

          <Text style={{ marginBottom: 0, marginTop: 24, color: "#8c8c8c", fontSize: 12 }}>
            Prelim — automated reminder
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
