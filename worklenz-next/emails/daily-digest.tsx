import { Body, Container, Head, Heading, Html, Preview, Section, Text, Row, Column } from "@react-email/components";

type DailyDigestProps = {
  recipientName: string;
  date: string;
  absentCount: number;
  pendingReviewCount: number;
  absentStaff: { name: string; email: string }[];
};

export function DailyDigest({
  recipientName,
  date,
  absentCount,
  pendingReviewCount,
  absentStaff
}: DailyDigestProps) {
  return (
    <Html>
      <Head />
      <Preview>Daily digest for {date}</Preview>
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
          <Heading style={{ marginTop: 0 }}>Daily Digest — {date}</Heading>
          <Text>Hi {recipientName},</Text>
          <Text>Here is today&apos;s summary.</Text>

          <Section
            style={{
              display: "grid",
              gap: "12px",
              marginBottom: "20px"
            }}
          >
            <Row>
              <Column>
                <Section style={{ background: "#fff7e6", borderRadius: 8, padding: "12px 16px", borderLeft: "4px solid #fa8c16" }}>
                  <Text style={{ margin: 0, fontSize: 12, color: "#8c8c8c", textTransform: "uppercase" }}>
                    Absent / Not Logged
                  </Text>
                  <Text style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 700, color: "#fa8c16" }}>
                    {absentCount}
                  </Text>
                </Section>
              </Column>
              <Column style={{ paddingLeft: 12 }}>
                <Section style={{ background: "#f0f5ff", borderRadius: 8, padding: "12px 16px", borderLeft: "4px solid #2f54eb" }}>
                  <Text style={{ margin: 0, fontSize: 12, color: "#8c8c8c", textTransform: "uppercase" }}>
                    Pending Review
                  </Text>
                  <Text style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 700, color: "#2f54eb" }}>
                    {pendingReviewCount}
                  </Text>
                </Section>
              </Column>
            </Row>
          </Section>

          {absentStaff.length > 0 && (
            <Section>
              <Text style={{ fontWeight: 600, marginBottom: 8 }}>Staff without attendance today:</Text>
              {absentStaff.map((s) => (
                <Text key={s.email} style={{ margin: "2px 0", fontSize: 14, color: "#595959" }}>
                  • {s.name || s.email}
                </Text>
              ))}
            </Section>
          )}

          <Text style={{ marginBottom: 0, marginTop: 24, color: "#8c8c8c", fontSize: 12 }}>
            Prelim — automated daily digest
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
