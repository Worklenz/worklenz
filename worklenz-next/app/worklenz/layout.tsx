import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ReactNode } from "react";

const navItems = [
  { href: "/worklenz/home", label: "Home" },
  { href: "/worklenz/projects", label: "Projects" },
  { href: "/worklenz/attendance", label: "Attendance" },
  { href: "/worklenz/review-queue", label: "Review Queue" },
  { href: "/worklenz/schedule", label: "Schedule" },
  { href: "/worklenz/gantt-demo", label: "Gantt Demo" }
];

export default function WorklenzLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "240px 1fr" }}>
      <aside style={{ background: "white", borderRight: "1px solid #e2e8f0", padding: 20 }}>
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>Prelim</h2>
        <nav style={{ display: "grid", gap: 10 }}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} style={{ padding: "10px 12px", borderRadius: 8 }}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section>
        <header
          style={{
            height: 64,
            borderBottom: "1px solid #e2e8f0",
            background: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 20px"
          }}
        >
          <UserButton />
        </header>
        <main style={{ padding: 24 }}>{children}</main>
      </section>
    </div>
  );
}
