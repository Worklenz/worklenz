import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? ""
  }
});

const r2Bucket = process.env.CLOUDFLARE_R2_BUCKET ?? "";

export async function createSignedUploadUrl(key: string, expiresInSeconds = 300) {
  const command = new PutObjectCommand({
    Bucket: r2Bucket,
    Key: key
  });
  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}

export async function createSignedDownloadUrl(key: string, expiresInSeconds = 300) {
  const command = new GetObjectCommand({
    Bucket: r2Bucket,
    Key: key
  });
  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}
