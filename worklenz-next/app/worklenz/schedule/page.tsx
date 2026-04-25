import { requireOneOfRoles } from "@/lib/auth/roles";

export default async function SchedulePage() {
  await requireOneOfRoles(["owner", "admin"]);

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Schedule</h1>
      <p>Role-protected route with Clerk role metadata validation.</p>
    </section>
  );
}
