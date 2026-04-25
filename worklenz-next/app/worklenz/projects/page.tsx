import Link from "next/link";

export default function ProjectsPage() {
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Projects</h1>
      <p>Project list route migrated from React Router to Next.js page routing.</p>
      <Link href="/worklenz/projects/sample-project-id" style={{ color: "#2563eb" }}>
        Open sample project route
      </Link>
    </section>
  );
}
