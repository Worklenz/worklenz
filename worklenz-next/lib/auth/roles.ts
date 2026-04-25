import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export async function requireOneOfRoles(roles: string[]) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = user.publicMetadata.role;

  if (typeof role !== "string" || !roles.includes(role)) {
    redirect("/worklenz/unauthorized");
  }

  return role;
}

export async function isOneOfRoles(roles: string[]) {
  const { userId } = await auth();
  if (!userId) {
    return false;
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = user.publicMetadata.role;

  return typeof role === "string" && roles.includes(role);
}
