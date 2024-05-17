import path from "path";
import {
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client
} from "@aws-sdk/client-s3";
import {isProduction, isTestServer, log_error} from "./utils";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import mime from "mime";

const {BUCKET, REGION, S3_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY} = process.env;

if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
  log_error("Invalid S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY. Please check .env file.");
}

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID as string,
    secretAccessKey: S3_SECRET_ACCESS_KEY as string,
  }
});

export function getRootDir() {
  if (isTestServer()) return "test-server";
  if (isProduction()) return "secure";
  return "local-server";
}

export function getKey(teamId: string, projectId: string, attachmentId: string, type: string) {
  return path.join(getRootDir(), teamId, projectId, `${attachmentId}.${type}`).replace(/\\/g, "/");
}

export function getAvatarKey(userId: string, type: string) {
  return path.join("avatars", getRootDir(), `${userId}.${type}`).replace(/\\/g, "/");
}

export async function uploadBuffer(buffer: Buffer, type: string, location: string): Promise<string | null> {
  try {
    // Set the parameters.
    const bucketParams: PutObjectCommandInput = {
      Bucket: BUCKET,
      // Specify the name of the new object. For example, 'index.html.'
      // To create a directory for the object, use '/'. For example, 'myApp/package.json'.
      Key: location,
      // Content of the new object.
      Body: buffer,
      ContentEncoding: "base64",
      ContentType: type
    };

    await s3Client.send(new PutObjectCommand(bucketParams));
    return `${S3_URL}/${location}`;
  } catch (error) {
    log_error(error);
  }

  return null;
}

export async function uploadBase64(base64Data: string, location: string) {
  try {
    const buffer = Buffer.from(base64Data.replace(/^data:(.*?);base64,/, ""), "base64");
    const type = base64Data.split(";")[0].split(":")[1] || null;

    if (!type) return null;

    await uploadBuffer(buffer, type, location);
    return `${S3_URL}/${location}`;
  } catch (error) {
    log_error(error);
  }

  return null;
}

export async function deleteObject(key: string) {
  try {
    const input: DeleteObjectCommandInput = {
      Bucket: BUCKET,
      Key: key,
    };
    return await s3Client.send(new DeleteObjectCommand(input));
  } catch (error) {
    return null;
  }
}

export async function calculateStorage(prefix: string) {
  try {
    let totalSize = 0;
    let continuationToken;
    let response: any | null = null;

    do {
      // Use the listObjectsV2 method to list objects in the folder
      const command: any = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: `${getRootDir()}/${prefix}`,
        ContinuationToken: continuationToken,
      });
      response = await s3Client.send(command);

      // Iterate over the objects and add their size to the total
      if (response?.Contents) {
        for (const obj of response.Contents) {
          totalSize += obj.Size;
        }
      }

      // If there are more objects to retrieve, set the continuation token
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    return totalSize;
  } catch (error) {
    log_error(error);
  }
}

export async function createPresignedUrlWithClient(key: string, file: string) {
  const fileExtension = path.extname(key).toLowerCase();
  const contentType = mime.lookup(fileExtension);
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentType: `${contentType}`,
    ResponseContentDisposition: `attachment; filename=${file}`,
  });
  return getSignedUrl(s3Client, command, {expiresIn: 3600});
}
