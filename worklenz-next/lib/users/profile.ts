import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export async function requireUserProfile() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const user = await currentUser();
  if (!user) {
    return null;
  }

  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error("Authenticated user has no email address.");
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || null;
  const metaRole = user.publicMetadata.role;
  const role = typeof metaRole === "string" ? metaRole : "qs";

  return prisma.userProfile.upsert({
    where: { clerkId: userId },
    update: {
      email,
      fullName,
      role
    },
    create: {
      clerkId: userId,
      email,
      fullName,
      role
    }
  });
}
