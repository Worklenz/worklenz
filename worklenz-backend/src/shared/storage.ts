import path from "path";
import {
  CopyObjectCommand,
  CopyObjectCommandInput,
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  ContainerClient,
  BlockBlobClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from "@azure/storage-blob";
// Import mime type library
const mimeTypes = require("mime");
import { isProduction, isTestServer, log_error } from "./utils";
import {
  AZURE_STORAGE_ACCOUNT_KEY,
  AZURE_STORAGE_ACCOUNT_NAME,
  AZURE_STORAGE_CONTAINER,
  AZURE_STORAGE_URL,
  BUCKET,
  REGION,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_URL,
  STORAGE_PROVIDER,
} from "./constants";

// Parse the endpoint URL from S3_URL if it exists
const getEndpointFromUrl = () => {
  try {
    if (!S3_URL) return undefined;

    // Extract the endpoint URL (e.g., http://minio:9000 from http://minio:9000/bucket)
    const url = new URL(S3_URL);
    return `${url.protocol}//${url.host}`;
  } catch (error) {
    console.warn("Error parsing S3_URL:", error);
    return undefined;
  }
};

// Initialize S3 Client with support for MinIO
const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID || "",
    secretAccessKey: S3_SECRET_ACCESS_KEY || "",
  },
  endpoint: getEndpointFromUrl(),
  forcePathStyle: true, // Required for MinIO
});

// Log the storage configuration
console.log(`Storage provider initialized: ${STORAGE_PROVIDER}`);
console.log(`Using endpoint: ${getEndpointFromUrl() || "AWS default"}`);
console.log(`Bucket: ${BUCKET}`);

// Initialize Azure Blob Storage Client
let azureBlobServiceClient: BlobServiceClient | null = null;
let azureContainerClient: ContainerClient | null = null;

if (STORAGE_PROVIDER === "azure") {
  try {
    if (!AZURE_STORAGE_ACCOUNT_NAME || !AZURE_STORAGE_ACCOUNT_KEY) {
      console.error("Azure Blob Storage credentials are missing");
    } else {
      const sharedKeyCredential = new StorageSharedKeyCredential(
        AZURE_STORAGE_ACCOUNT_NAME,
        AZURE_STORAGE_ACCOUNT_KEY,
      );

      azureBlobServiceClient = new BlobServiceClient(
        `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
        sharedKeyCredential,
      );

      const containerName = AZURE_STORAGE_CONTAINER || "ifinitycdn";
      azureContainerClient =
        azureBlobServiceClient.getContainerClient(containerName);

      console.log(
        `Azure Blob Storage initialized with account: ${AZURE_STORAGE_ACCOUNT_NAME}, container: ${containerName}`,
      );
    }
  } catch (error) {
    console.error("Failed to initialize Azure Blob Storage:", error);
  }
}

export function getRootDir() {
  if (isTestServer()) return "test-server";
  if (isProduction()) return "secure";
  return "local-server";
}

export function getKey(
  teamId: string,
  projectId: string,
  attachmentId: string,
  type: string,
) {
  const keyPath = path
    .join(getRootDir(), teamId, projectId, `${attachmentId}.${type}`)
    .replace(/\\/g, "/");

  return keyPath;
}

export function getProjectFileStorageKey(
  teamId: string,
  projectId: string,
  fileId: string,
  extension: string,
) {
  // Uses getRootDir() so project files land under the same root prefix as task
  // attachments (e.g. "secure/{teamId}/projects/..."). This ensures
  // calculateStorage(teamId) in the admin-center controller picks up project
  // files automatically without any additional changes to that controller.
  const keyPath = path
    .join(
      getRootDir(),
      teamId,
      "projects",
      projectId,
      "files",
      `${fileId}.${extension}`,
    )
    .replace(/\\/g, "/");

  return keyPath;
}

export function getTaskAttachmentKey(
  teamId: string,
  projectId: string,
  taskId: string,
  commentId: string,
  attachmentId: string,
  type: string,
) {
  const keyPath = path
    .join(
      getRootDir(),
      teamId,
      projectId,
      taskId,
      commentId,
      `${attachmentId}.${type}`,
    )
    .replace(/\\/g, "/");

  return keyPath;
}

export function getAvatarKey(userId: string, type: string) {
  const keyPath = path
    .join("avatars", getRootDir(), `${userId}.${type}`)
    .replace(/\\/g, "/");

  return keyPath;
}

export function getClientPortalLogoKey(teamId: string, type: string) {
  const keyPath = path
    .join("client-portal-logos", getRootDir(), `${teamId}.${type}`)
    .replace(/\\/g, "/");

  return keyPath;
}

export function getOrganizationLogoKey(
  organizationId: string,
  fileExtension: string,
) {
  const keyPath = path
    .join(
      "organization-logos",
      getRootDir(),
      `${organizationId}.${fileExtension}`,
    )
    .replace(/\\/g, "/");

  return keyPath;
}

/**
 * Get the environment prefix for client portal storage
 * Uses explicit environment names: prod, uat, dev
 * @returns Environment prefix string
 */
export function getEnvironmentPrefix(): string {
  if (isProduction()) return "prod";
  if (isTestServer()) return "uat";
  return "dev";
}

/**
 * Client Portal Storage Purposes
 */
export type ClientPortalStoragePurpose =
  | "request-attachments"
  | "chat-files"
  | "avatars"
  | "service-images"
  | "documents"
  | "payment-proofs"
  | "general";

/**
 * Generate a storage key for client portal files with environment-based directories
 * All files are stored under organizations/{organizationId}/client-portal/{purpose}/...
 * This structure allows easy tracking of storage usage per organization/team
 *
 * Structure: {env}/organizations/{organizationId}/client-portal/{purpose}/{...pathSegments}
 *
 * @param purpose - The purpose/category of the file (request-attachments, chat-files, etc.)
 * @param organizationId - The organization team ID
 * @param pathSegments - Additional path segments (e.g., clientId, requestId, filename)
 * @returns Full storage key path
 *
 * @example
 * // For request attachment:
 * getClientPortalStorageKey("request-attachments", "org-123", "client-456", "file.pdf")
 * // Returns: "prod/organizations/org-123/client-portal/request-attachments/client-456/file.pdf"
 *
 * // For payment proof:
 * getClientPortalStorageKey("payment-proofs", "org-123", "client-456", "proof.jpg")
 * // Returns: "prod/organizations/org-123/client-portal/payment-proofs/client-456/proof.jpg"
 */
export function getClientPortalStorageKey(
  purpose: ClientPortalStoragePurpose,
  organizationId: string,
  ...pathSegments: string[]
): string {
  const env = getEnvironmentPrefix();

  // All client portal files are stored under organizations/{orgId}/client-portal/{purpose}/
  // This allows easy tracking of storage usage per organization/team
  const keyPath = path
    .join(
      env,
      "organizations",
      organizationId,
      "client-portal",
      purpose,
      ...pathSegments,
    )
    .replace(/\\/g, "/");

  return keyPath;
}

/**
 * Generate a unique filename for client portal uploads
 * Format: {prefix}_{timestamp}_{randomId}.{extension}
 *
 * @param originalFilename - Original filename with extension
 * @param prefix - Optional prefix (e.g., "client", "request")
 * @returns Unique filename
 */
export function generateUniqueFilename(
  originalFilename: string,
  prefix = "file",
): string {
  const extension = originalFilename
    .substring(originalFilename.lastIndexOf(".") + 1)
    .toLowerCase();
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 11);
  return `${prefix}_${timestamp}_${randomId}.${extension}`;
}

/**
 * Extract file extension from filename (without dot)
 * @param filename - Filename with extension
 * @returns Extension without dot, lowercase
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.substring(lastDot + 1).toLowerCase();
}

async function uploadBufferToS3(
  buffer: Buffer,
  type: string,
  location: string,
): Promise<string | null> {
  try {
    const bucketParams: PutObjectCommandInput = {
      Bucket: BUCKET,
      Key: location,
      Body: buffer,
      ContentEncoding: "base64",
      ContentType: type,
    };

    await s3Client.send(new PutObjectCommand(bucketParams));

    // Create proper URL depending on whether we're using S3 or MinIO
    const endpointUrl = getEndpointFromUrl();
    if (endpointUrl) {
      // For MinIO or custom S3 endpoint
      return `${endpointUrl}/${BUCKET}/${location}`;
    }

    // For standard AWS S3
    return `${S3_URL}/${location}`;
  } catch (error) {
    log_error(error);
    return null;
  }
}

async function uploadBufferToAzure(
  buffer: Buffer,
  type: string,
  location: string,
): Promise<string | null> {
  try {
    if (!azureContainerClient) {
      throw new Error("Azure Blob Storage not configured properly");
    }

    const blobClient = azureContainerClient.getBlockBlobClient(location);

    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: type,
      },
    });

    // Format URL with container name in the path
    const containerName = AZURE_STORAGE_CONTAINER || "ifinitycdn";
    return `${AZURE_STORAGE_URL}/${containerName}/${location}`;
  } catch (error) {
    log_error(error);
    return null;
  }
}

export async function uploadBuffer(
  buffer: Buffer,
  type: string,
  location: string,
): Promise<string | null> {
  if (STORAGE_PROVIDER === "azure") {
    return uploadBufferToAzure(buffer, type, location);
  }
  return uploadBufferToS3(buffer, type, location);
}

export async function uploadBase64(base64Data: string, location: string) {
  try {
    const buffer = Buffer.from(
      base64Data.replace(/^data:(.*?);base64,/, ""),
      "base64",
    );
    const type = base64Data.split(";")[0].split(":")[1] || null;

    if (!type) return null;

    return await uploadBuffer(buffer, type, location);
  } catch (error) {
    log_error(error);
    return null;
  }
}

async function deleteObjectFromS3(key: string) {
  try {
    const input: DeleteObjectCommandInput = {
      Bucket: BUCKET,
      Key: key,
    };
    return await s3Client.send(new DeleteObjectCommand(input));
  } catch (error) {
    log_error(error);
    return null;
  }
}

async function deleteObjectFromAzure(key: string) {
  try {
    if (!azureContainerClient) {
      throw new Error("Azure Blob Storage not configured properly");
    }

    const blobClient = azureContainerClient.getBlockBlobClient(key);
    return await blobClient.delete();
  } catch (error) {
    log_error(error);
    return null;
  }
}

export async function deleteObject(key: string) {
  if (STORAGE_PROVIDER === "azure") {
    return deleteObjectFromAzure(key);
  }
  return deleteObjectFromS3(key);
}

async function copyObjectInS3(sourceKey: string, destinationKey: string) {
  try {
    const copyParams: CopyObjectCommandInput = {
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${sourceKey}`,
      Key: destinationKey,
    };
    await s3Client.send(new CopyObjectCommand(copyParams));
    return true;
  } catch (error) {
    log_error(error);
    return false;
  }
}

async function copyObjectInAzure(sourceKey: string, destinationKey: string) {
  try {
    if (!azureContainerClient) {
      throw new Error("Azure Blob Storage not configured properly");
    }

    const sourceBlobClient = azureContainerClient.getBlockBlobClient(sourceKey);
    const destinationBlobClient =
      azureContainerClient.getBlockBlobClient(destinationKey);

    // Azure Blob Storage copy operation - beginCopyFromURL returns a Promise that resolves to a poller
    const poller = await destinationBlobClient.beginCopyFromURL(
      sourceBlobClient.url,
    );

    // Wait for the copy operation to complete
    await poller.pollUntilDone();

    return true;
  } catch (error) {
    log_error(error);
    return false;
  }
}

export async function copyObject(sourceKey: string, destinationKey: string) {
  if (STORAGE_PROVIDER === "azure") {
    return copyObjectInAzure(sourceKey, destinationKey);
  }
  return copyObjectInS3(sourceKey, destinationKey);
}

async function calculateStorageS3(prefix: string) {
  try {
    let totalSize = 0;
    let continuationToken;
    let response: any | null = null;

    do {
      const command: any = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: `${getRootDir()}/${prefix}`,
        ContinuationToken: continuationToken,
      });
      response = await s3Client.send(command);

      if (response?.Contents) {
        for (const obj of response.Contents) {
          totalSize += obj.Size;
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    return totalSize;
  } catch (error) {
    log_error(error);
    return 0;
  }
}

async function calculateStorageAzure(prefix: string) {
  try {
    if (!azureContainerClient) {
      throw new Error("Azure Blob Storage not configured properly");
    }

    let totalSize = 0;
    const fullPrefix = `${getRootDir()}/${prefix}`;

    // List all blobs with the specified prefix
    for await (const blob of azureContainerClient.listBlobsFlat({
      prefix: fullPrefix,
    })) {
      if (blob.properties.contentLength) {
        totalSize += blob.properties.contentLength;
      }
    }

    return totalSize;
  } catch (error) {
    log_error(error);
    return 0;
  }
}

export async function calculateStorage(prefix: string) {
  if (STORAGE_PROVIDER === "azure") {
    return calculateStorageAzure(prefix);
  }
  return calculateStorageS3(prefix);
}

async function createPresignedUrlWithS3Client(key: string, file: string) {
  const fileExtension = path.extname(key).toLowerCase();
  const contentType = mimeTypes.lookup(fileExtension);
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentType: `${contentType}`,
    ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file)}`,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

async function createPresignedUrlWithAzureClient(key: string, file: string) {
  try {
    if (
      !azureContainerClient ||
      !AZURE_STORAGE_ACCOUNT_NAME ||
      !AZURE_STORAGE_ACCOUNT_KEY
    ) {
      throw new Error("Azure Blob Storage not configured properly");
    }

    const blobClient = azureContainerClient.getBlockBlobClient(key);

    // Create a SAS token that's valid for one hour
    const sharedKeyCredential = new StorageSharedKeyCredential(
      AZURE_STORAGE_ACCOUNT_NAME,
      AZURE_STORAGE_ACCOUNT_KEY,
    );

    const fileExtension = path.extname(key).toLowerCase();
    const contentType = mimeTypes.lookup(fileExtension);
    const containerName = AZURE_STORAGE_CONTAINER || "ifinitycdn";

    const sasOptions = {
      containerName,
      blobName: key,
      permissions: BlobSASPermissions.parse("r"), // Read permission
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file)}`,
      contentType: contentType || undefined,
    };

    const sasToken = generateBlobSASQueryParameters(
      sasOptions,
      sharedKeyCredential,
    ).toString();

    // Generate URL with container name in the path
    return `${AZURE_STORAGE_URL}/${containerName}/${key}?${sasToken}`;
  } catch (error) {
    log_error(error);
    return null;
  }
}

export async function createPresignedUrlWithClient(key: string, file: string) {
  if (STORAGE_PROVIDER === "azure") {
    return createPresignedUrlWithAzureClient(key, file);
  }
  return createPresignedUrlWithS3Client(key, file);
}
