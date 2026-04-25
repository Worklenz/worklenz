import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function IndexPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  redirect("/worklenz/home");
}
