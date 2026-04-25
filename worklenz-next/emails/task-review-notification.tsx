import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

type TaskReviewNotificationProps = {
  recipientName: string;
  taskTitle: string;
  status: "approved" | "rejected" | "revision_required";
  comment?: string;
};

export function TaskReviewNotification({
  recipientName,
  taskTitle,
  status,
  comment
}: TaskReviewNotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>Task review update: {taskTitle}</Preview>
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
          <Heading style={{ marginTop: 0 }}>Task Review Update</Heading>
          <Text>Hi {recipientName},</Text>
          <Text>
            Your task <strong>{taskTitle}</strong> was marked as <strong>{status.replace("_", " ")}</strong>.
          </Text>
          {comment ? (
            <Section
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                padding: "12px"
              }}
            >
              <Text style={{ margin: 0 }}>{comment}</Text>
            </Section>
          ) : null}
          <Text style={{ marginBottom: 0 }}>Prelim</Text>
        </Container>
      </Body>
    </Html>
  );
}
