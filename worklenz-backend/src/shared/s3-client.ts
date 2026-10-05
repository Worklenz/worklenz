import { S3Client } from "@aws-sdk/client-s3";
import { REGION, S3_ACCESS_KEY_ID, S3_ENDPOINT, S3_SECRET_ACCESS_KEY, S3_URL } from "./constants";

export const getPublicEndpointFromUrl = () => {
  try {
    const url = new URL(S3_URL);
    return `${url.protocol}//${url.host}`;
  } catch (error) {
    console.warn("Error parsing S3_PUBLIC_URL:", error);
    return S3_ENDPOINT;
  }
};

export const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID || "",
    secretAccessKey: S3_SECRET_ACCESS_KEY || "",
  },
  endpoint: S3_ENDPOINT,
  forcePathStyle: Boolean(S3_ENDPOINT),
});

export const presignS3Client = S3_ENDPOINT
  ? new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID || "",
        secretAccessKey: S3_SECRET_ACCESS_KEY || "",
      },
      endpoint: getPublicEndpointFromUrl(),
      forcePathStyle: true,
    })
  : s3Client;
