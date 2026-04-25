import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createSignedDownloadUrl, createSignedUploadUrl } from "@/lib/storage/r2";

type SignBody = {
  key: string;
  mode: "upload" | "download";
  expiresInSeconds?: number;
};

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as SignBody;

  if (!body.key || !body.mode) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const expiresInSeconds = body.expiresInSeconds ?? 300;
  const url =
    body.mode === "upload"
      ? await createSignedUploadUrl(body.key, expiresInSeconds)
      : await createSignedDownloadUrl(body.key, expiresInSeconds);

  return NextResponse.json({ url, expiresInSeconds });
}
