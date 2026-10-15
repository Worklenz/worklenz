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
  // Newer SDKs sign a CRC32 of the (empty) body into presigned PUT URLs, so the browser's real upload
  // fails the checksum. Only compute checksums where the API requires them.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
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
      // Newer SDKs sign a CRC32 of the (empty) body into presigned PUT URLs, so the browser's real upload
      // fails the checksum. Only compute checksums where the API requires them.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    })
  : s3Client;
