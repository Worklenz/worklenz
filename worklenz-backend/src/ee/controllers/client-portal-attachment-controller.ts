import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import {
  uploadBase64,
  deleteObject,
  getClientPortalStorageKey,
  generateUniqueFilename,
  getFileExtension,
  ClientPortalStoragePurpose
} from "../../shared/storage";

// Extended request type for client portal
interface AuthenticatedClientRequest {
  clientId?: string;
  organizationId?: string;
  clientEmail?: string;
  body: any;
  params: any;
  query: any;
  user?: any;
}

export default class ClientPortalAttachmentController {

  // File upload with environment-based S3 storage and database tracking
  static async uploadFile(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { clientId, organizationId } = req;
      const { fileData, fileName, fileType, purpose = "general" } = req.body;

      // Validate required fields
      if (!fileData || !fileName) {
        return res.status(400).json(new ServerResponse(false, null, "File data and filename are required"));
      }

      // Validate file size (assuming base64 data)
      const fileSizeBytes = Math.floor((fileData.length * 3) / 4);
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB limit

      if (fileSizeBytes > maxSizeBytes) {
        return res.status(400).json(new ServerResponse(false, null, "File size exceeds 10MB limit"));
      }

      // Validate file type
      const allowedTypes = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf", "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain", "text/csv"
      ];

      if (fileType && !allowedTypes.includes(fileType)) {
        return res.status(400).json(new ServerResponse(false, null, "File type not allowed"));
      }

      // Generate unique filename with client prefix
      const uniqueFileName = generateUniqueFilename(fileName, "client");
      const fileExtension = getFileExtension(fileName);

      // Validate and normalize purpose to match database constraint
      // Database allows: 'request', 'chat', 'avatar', 'document', 'payment_proof', 'general'
      const allowedPurposes = ["request", "chat", "avatar", "document", "payment_proof", "general"];
      const normalizedPurpose = allowedPurposes.includes(purpose) ? purpose : "general";

      // Map purpose to storage purpose type
      const storagePurposeMap: Record<string, ClientPortalStoragePurpose> = {
        "request": "request-attachments",
        "chat": "chat-files",
        "avatar": "avatars",
        "document": "documents",
        "payment_proof": "payment-proofs",
        "general": "general"
      };

      const storagePurpose = storagePurposeMap[normalizedPurpose] || "general";

      // Generate storage key with environment-based directory structure
      // Structure: {env}/client-portal/{purpose}/{organizationId}/{clientId}/{filename}
      const storageKey = getClientPortalStorageKey(
        storagePurpose,
        organizationId as string,
        clientId as string,
        uniqueFileName
      );

      try {
        // Upload to storage using existing uploadBase64 function
        const fileUrl = await uploadBase64(fileData, storageKey);

        if (!fileUrl) {
          return res.status(500).json(new ServerResponse(false, null, "Failed to upload file to storage"));
        }

        // Save attachment record to database for tracking
        const insertQuery = `
          INSERT INTO client_portal_attachments (
            organization_team_id,
            client_id,
            original_name,
            storage_key,
            file_url,
            file_type,
            file_extension,
            file_size,
            purpose,
            uploaded_by_client_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id, original_name, storage_key, file_url, file_type, file_extension, file_size, purpose, created_at
        `;

        const insertResult = await db.query(insertQuery, [
          organizationId,
          clientId,
          fileName,
          storageKey,
          fileUrl,
          fileType || "application/octet-stream",
          fileExtension,
          fileSizeBytes,
          normalizedPurpose,
          clientId
        ]);

        const attachment = insertResult.rows[0];

        return res.json(new ServerResponse(true, {
          id: attachment.id,
          url: attachment.file_url,
          filename: uniqueFileName,
          originalName: attachment.original_name,
          fileType: attachment.file_type,
          fileExtension: attachment.file_extension,
          purpose: attachment.purpose,
          size: attachment.file_size,
          storageKey: attachment.storage_key,
          uploadedAt: attachment.created_at
        }, "File uploaded successfully"));
      } catch (uploadError) {
        console.error("Error uploading file to storage:", uploadError);
        return res.status(500).json(new ServerResponse(false, null, "Failed to upload file to storage"));
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to upload file"));
    }
  }

  // Get attachments for a request
  static async getRequestAttachments(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { requestId } = req.params;
      const { clientId, organizationId } = req;

      // Verify request belongs to client
      const requestCheck = await db.query(
        "SELECT id FROM client_portal_requests WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [requestId, clientId, organizationId]
      );

      if (requestCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Request not found"));
      }

      const query = `
        SELECT 
          id,
          original_name,
          file_url,
          file_type,
          file_extension,
          file_size,
          purpose,
          created_at
        FROM client_portal_attachments
        WHERE request_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [requestId]);
      const attachments = result.rows.map((row: any) => ({
        id: row.id,
        originalName: row.original_name,
        url: row.file_url,
        fileType: row.file_type,
        fileExtension: row.file_extension,
        size: row.file_size,
        purpose: row.purpose,
        uploadedAt: row.created_at
      }));

      return res.json(new ServerResponse(true, attachments, "Attachments retrieved successfully"));
    } catch (error) {
      console.error("Error fetching request attachments:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve attachments"));
    }
  }

  // Link attachments to a request (called after request creation)
  static async linkAttachmentsToRequest(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { requestId } = req.params;
      const { attachmentIds } = req.body;
      const { clientId, organizationId } = req;

      if (!attachmentIds || !Array.isArray(attachmentIds) || attachmentIds.length === 0) {
        return res.status(400).json(new ServerResponse(false, null, "Attachment IDs are required"));
      }

      // Verify request belongs to client
      const requestCheck = await db.query(
        "SELECT id FROM client_portal_requests WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [requestId, clientId, organizationId]
      );

      if (requestCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Request not found"));
      }

      // Update attachments to link them to the request
      const updateQuery = `
        UPDATE client_portal_attachments
        SET request_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($2::uuid[])
        AND client_id = $3
        AND organization_team_id = $4
        AND request_id IS NULL
        AND deleted_at IS NULL
        RETURNING id
      `;

      const result = await db.query(updateQuery, [requestId, attachmentIds, clientId, organizationId]);
      const linkedCount = result.rows.length;

      return res.json(new ServerResponse(true, {
        linkedCount,
        requestId
      }, `${linkedCount} attachment(s) linked to request`));
    } catch (error) {
      console.error("Error linking attachments to request:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to link attachments"));
    }
  }

  // Delete an attachment
  static async deleteAttachment(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { attachmentId } = req.params;
      const { clientId, organizationId } = req;

      // Get attachment details and verify ownership
      const attachmentQuery = await db.query(
        `SELECT id, storage_key, request_id 
         FROM client_portal_attachments 
         WHERE id = $1 AND client_id = $2 AND organization_team_id = $3 AND deleted_at IS NULL`,
        [attachmentId, clientId, organizationId]
      );

      if (attachmentQuery.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Attachment not found"));
      }

      const attachment = attachmentQuery.rows[0];

      // If attachment is linked to a request, check if request is still in pending status
      if (attachment.request_id) {
        const requestCheck = await db.query(
          "SELECT status FROM client_portal_requests WHERE id = $1",
          [attachment.request_id]
        );

        if (requestCheck.rows.length > 0 && requestCheck.rows[0].status !== "pending") {
          return res.status(400).json(new ServerResponse(false, null, "Cannot delete attachment from a processed request"));
        }
      }

      // Soft delete the attachment
      await db.query(
        "UPDATE client_portal_attachments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1",
        [attachmentId]
      );

      // Delete from S3
      try {
        await deleteObject(attachment.storage_key);
      } catch (deleteError) {
        console.error("Error deleting file from storage:", deleteError);
        // Continue even if S3 delete fails - the DB record is soft deleted
      }

      return res.json(new ServerResponse(true, null, "Attachment deleted successfully"));
    } catch (error) {
      console.error("Error deleting attachment:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to delete attachment"));
    }
  }

  // Get client's unlinked attachments (for showing in file uploader before request submission)
  static async getUnlinkedAttachments(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { clientId, organizationId } = req;
      const { purpose } = req.query;

      let query = `
        SELECT 
          id,
          original_name,
          file_url,
          file_type,
          file_extension,
          file_size,
          purpose,
          created_at
        FROM client_portal_attachments
        WHERE client_id = $1 
        AND organization_team_id = $2 
        AND request_id IS NULL 
        AND deleted_at IS NULL
      `;

      const queryParams: any[] = [clientId, organizationId];

      // Validate purpose if provided
      if (purpose) {
        const allowedPurposes = ["request", "chat", "avatar", "document", "payment_proof", "general"];
        if (allowedPurposes.includes(purpose as string)) {
          query += ` AND purpose = $3`;
          queryParams.push(purpose);
        }
      }

      query += ` ORDER BY created_at DESC LIMIT 50`;

      const result = await db.query(query, queryParams);
      const attachments = result.rows.map((row: any) => ({
        id: row.id,
        originalName: row.original_name,
        url: row.file_url,
        fileType: row.file_type,
        fileExtension: row.file_extension,
        size: row.file_size,
        purpose: row.purpose,
        uploadedAt: row.created_at
      }));

      return res.json(new ServerResponse(true, attachments, "Unlinked attachments retrieved successfully"));
    } catch (error) {
      console.error("Error fetching unlinked attachments:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve attachments"));
    }
  }

  // Get attachment by ID
  static async getAttachment(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { attachmentId } = req.params;
      const { clientId, organizationId } = req;

      const query = `
        SELECT 
          id,
          original_name,
          file_url,
          file_type,
          file_extension,
          file_size,
          purpose,
          request_id,
          created_at
        FROM client_portal_attachments
        WHERE id = $1 
        AND client_id = $2 
        AND organization_team_id = $3 
        AND deleted_at IS NULL
      `;

      const result = await db.query(query, [attachmentId, clientId, organizationId]);

      if (result.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Attachment not found"));
      }

      const row = result.rows[0];
      const attachment = {
        id: row.id,
        originalName: row.original_name,
        url: row.file_url,
        fileType: row.file_type,
        fileExtension: row.file_extension,
        size: row.file_size,
        purpose: row.purpose,
        requestId: row.request_id,
        uploadedAt: row.created_at
      };

      return res.json(new ServerResponse(true, attachment, "Attachment retrieved successfully"));
    } catch (error) {
      console.error("Error fetching attachment:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve attachment"));
    }
  }
}
