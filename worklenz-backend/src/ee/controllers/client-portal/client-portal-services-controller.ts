import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";
import { uploadBase64, deleteObject, getClientPortalStorageKey } from "../../../shared/storage";

export default class ClientPortalServicesController extends ClientPortalControllerBase {
  
  // Helper function to validate and process service_key
  private static async validateServiceKey(
    serviceKey: string | null | undefined,
    organizationId: string,
    excludeServiceId?: string
  ): Promise<{ isValid: boolean; error?: string; finalKey: string | null }> {
    if (serviceKey === null || serviceKey === undefined || serviceKey === '') {
      return { isValid: true, finalKey: null };
    }

    // Validate format: 2-6 uppercase alphanumeric characters
    const keyRegex = /^[A-Z0-9]{2,6}$/;
    const upperKey = serviceKey.toUpperCase();
    if (!keyRegex.test(upperKey)) {
      return {
        isValid: false,
        error: "Service key must be 2-6 uppercase alphanumeric characters (A-Z, 0-9)",
        finalKey: null,
      };
    }

    // Check if service_key already exists for this organization
    const keyCheckQuery = excludeServiceId
      ? `SELECT id FROM client_portal_services WHERE organization_team_id = $1 AND service_key = $2 AND id != $3`
      : `SELECT id FROM client_portal_services WHERE organization_team_id = $1 AND service_key = $2`;
    const keyCheckValues = excludeServiceId
      ? [organizationId, upperKey, excludeServiceId]
      : [organizationId, upperKey];
    
    const keyCheck = await db.query(keyCheckQuery, keyCheckValues);
    if (keyCheck.rows.length > 0) {
      return {
        isValid: false,
        error: `Service key "${upperKey}" is already in use. Please choose a different key.`,
        finalKey: null,
      };
    }

    return { isValid: true, finalKey: upperKey };
  }

  // Helper function to auto-generate service_key from name
  private static async generateServiceKey(
    name: string,
    organizationId: string
  ): Promise<string | null> {
    const cleanName = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleanName.length < 2) {
      return null;
    }

    let baseKey = cleanName.substring(0, Math.min(6, cleanName.length));
    let counter = 1;
    let uniqueKey = baseKey;

    while (true) {
      const keyCheck = await db.query(
        `SELECT id FROM client_portal_services WHERE organization_team_id = $1 AND service_key = $2`,
        [organizationId, uniqueKey]
      );
      if (keyCheck.rows.length === 0) {
        return uniqueKey;
      }
      // If key exists, try appending a number (max 6 chars total)
      const baseKeyLength = Math.max(0, 6 - String(counter).length);
      const baseKeyPart = baseKey.substring(0, baseKeyLength);
      uniqueKey = baseKeyPart + counter;
      counter++;
      if (counter > 999) break; // Safety limit
    }

    return null; // Could not generate unique key
  }

  static async getServices(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { page = 1, limit = 10, status = "active" } = req.query;

      // Get services that are either public or specifically allowed for this client
      const query = `
        SELECT
          s.id,
          s.name,
          s.description,
          s.status,
          s.service_data,
          s.is_public,
          s.created_at,
          s.updated_at,
          s.price,
          s.currency
        FROM client_portal_services s
        WHERE s.organization_team_id = $1
        AND s.status = $2
        AND (s.is_public = true OR $3 = ANY(s.allowed_client_ids))
        ORDER BY s.name ASC
      `;

      const result = await db.query(query, [organizationId, status, clientId]);
      const services = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        serviceData: row.service_data,
        isPublic: row.is_public,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        price: row.price || 0,
        currency: row.currency || "USD",
      }));

      return res.json(
        new ServerResponse(true, services, "Services retrieved successfully")
      );
    } catch (error) {
      console.error("Error fetching services:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve services"));
    }
  }

  static async getServiceDetails(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;

      // Get service details if client has access
      const query = `
        SELECT
          s.id,
          s.name,
          s.description,
          s.status,
          s.service_data,
          s.is_public,
          s.created_at,
          s.updated_at,
          s.price,
          s.currency
        FROM client_portal_services s
        WHERE s.id = $1
        AND s.organization_team_id = $2
        AND s.status = 'active'
        AND (s.is_public = true OR $3 = ANY(s.allowed_client_ids))
      `;

      const result = await db.query(query, [id, organizationId, clientId]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(
              false,
              null,
              "Service not found or not accessible"
            )
          );
      }

      const service = result.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: service.id,
            name: service.name,
            description: service.description,
            status: service.status,
            serviceData: service.service_data,
            isPublic: service.is_public,
            createdAt: service.created_at,
            updatedAt: service.updated_at,
            price: service.price || 0,
            currency: service.currency || "USD",
          },
          "Service details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching service details:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve service details")
        );
    }
  }

  static async getOrganizationServices(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { organizationId } = req;
      const {
        page = 1,
        limit = 10,
        search,
        sortBy = "name",
        sortOrder = "asc",
      } = req.query;

      let whereClause = "WHERE s.organization_team_id = $1";
      const queryParams = [organizationId];
      let paramCount = 1;

      // Add search filter
      if (search) {
        paramCount++;
        whereClause += ` AND (LOWER(s.name) LIKE LOWER($${paramCount}) OR LOWER(s.description) LIKE LOWER($${paramCount}))`;
        queryParams.push(`%${search}%`);
      }

      // Build main query
      const query = `
        SELECT
          s.id,
          s.name,
          s.description,
          s.status,
          s.service_data,
          s.is_public,
          s.created_at,
          s.updated_at,
          u.name as created_by_name,
          COUNT(r.id) as requests_count
        FROM client_portal_services s
        LEFT JOIN users u ON s.created_by = u.id
        LEFT JOIN client_portal_requests r ON s.id = r.service_id
        ${whereClause}
        GROUP BY s.id, u.name
        ORDER BY ${sortBy} ${String(sortOrder).toUpperCase()}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(
        String(limit),
        String((Number(page) - 1) * Number(limit))
      );

      const result = await db.query(query, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM client_portal_services s
        ${whereClause}
      `;
      const countResult = await db.query(
        countQuery,
        queryParams.slice(0, paramCount)
      );
      const total = parseInt(countResult.rows[0].total);

      const services = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        serviceData: row.service_data,
        isPublic: row.is_public,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdByName: row.created_by_name,
        requestsCount: parseInt(row.requests_count || 0),
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            services,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Organization services retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching organization services:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(
            false,
            null,
            "Failed to retrieve organization services"
          )
        );
    }
  }

  static async getOrganizationServiceById(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { organizationId } = req;

      const query = `
        SELECT
          s.id,
          s.name,
          s.description,
          s.status,
          s.service_data,
          s.is_public,
          s.allowed_client_ids,
          s.price,
          s.currency,
          s.category,
          s.created_at,
          s.updated_at,
          u.name as created_by_name
        FROM client_portal_services s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.id = $1 AND s.organization_team_id = $2
      `;

      const result = await db.query(query, [id, organizationId]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Service not found"));
      }

      const service = result.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: service.id,
            name: service.name,
            description: service.description,
            status: service.status,
            serviceData: service.service_data,
            isPublic: service.is_public,
            allowedClientIds: service.allowed_client_ids,
            price: service.price,
            currency: service.currency,
            category: service.category,
            createdAt: service.created_at,
            updatedAt: service.updated_at,
            createdByName: service.created_by_name,
          },
          "Service retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching service:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve service"));
    }
  }

  static async createOrganizationService(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const {
        name,
        description,
        service_data,
        is_public = false,
        allowed_client_ids = [],
        price,
        currency,
        category,
        service_key,
        // Image upload fields
        imageData,
        imageName,
        imageType,
      } = req.body;
      const { organizationId, clientUserId } = req;

      if (!name) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Service name is required"));
      }

      // Validate and process service_key
      let finalServiceKey: string | null = null;
      if (!organizationId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Organization ID is required"));
      }
      if (service_key) {
        const keyValidation = await ClientPortalServicesController.validateServiceKey(
          service_key,
          organizationId
        );
        if (!keyValidation.isValid) {
          return res
            .status(400)
            .json(new ServerResponse(false, null, keyValidation.error || "Invalid service key"));
        }
        finalServiceKey = keyValidation.finalKey;
      } else {
        // Auto-generate service_key from name if not provided
        finalServiceKey = await ClientPortalServicesController.generateServiceKey(name, organizationId);
      }

      let finalServiceData = { ...service_data };

      // Handle image upload if provided
      if (imageData && imageName && imageType) {
        // Validate image
        const allowedImageTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
        ];
        if (!allowedImageTypes.includes(imageType)) {
          return res
            .status(400)
            .json(
              new ServerResponse(
                false,
                null,
                "Only JPEG, PNG, GIF, and WebP images are allowed"
              )
            );
        }

        // Validate file size (assuming base64 data) - 5MB limit
        const fileSizeBytes = Math.floor((imageData.length * 3) / 4);
        const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit

        if (fileSizeBytes > maxSizeBytes) {
          return res
            .status(400)
            .json(
              new ServerResponse(false, null, "Image size exceeds 5MB limit")
            );
        }

        // Generate unique filename and storage key
        const fileExtension = imageName.substring(imageName.lastIndexOf("."));
        const uniqueFileName = `service_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}${fileExtension}`;
        // Use getClientPortalStorageKey to ensure files are stored under organizations/{orgId}/client-portal/
        if (!organizationId) {
          return res
            .status(400)
            .json(new ServerResponse(false, null, "Organization ID is required"));
        }
        const storageKey = getClientPortalStorageKey("service-images", organizationId, uniqueFileName);

        try {
          // Upload to S3
          const imageUrl = await uploadBase64(imageData, storageKey);

          if (!imageUrl) {
            return res
              .status(500)
              .json(
                new ServerResponse(
                  false,
                  null,
                  "Failed to upload service image"
                )
              );
          }

          // Add image URL to service data
          finalServiceData = {
            ...finalServiceData,
            images: [imageUrl],
          };
        } catch (uploadError) {
          console.error("Error uploading service image:", uploadError);
          return res
            .status(500)
            .json(
              new ServerResponse(false, null, "Failed to upload service image")
            );
        }
      } else {
        console.log("No image data provided in request");
      }

      const query = `
        INSERT INTO client_portal_services (
          name, description, service_data, is_public, allowed_client_ids,
          price, currency, category, service_key,
          team_id, organization_team_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const result = await db.query(query, [
        name,
        description,
        JSON.stringify(finalServiceData), // Ensure proper JSON stringification
        is_public,
        allowed_client_ids,
        price,
        currency,
        category,
        finalServiceKey,
        organizationId, // team_id
        organizationId, // organization_team_id
        clientUserId,
      ]);

      const service = result.rows[0];

      return res.status(201).json(
        new ServerResponse(
          true,
          {
            id: service.id,
            name: service.name,
            description: service.description,
            status: service.status,
            serviceData: service.service_data,
            isPublic: service.is_public,
            allowedClientIds: service.allowed_client_ids,
            price: service.price,
            currency: service.currency,
            category: service.category,
            serviceKey: service.service_key,
            createdAt: service.created_at,
            updatedAt: service.updated_at,
          },
          "Service created successfully"
        )
      );
    } catch (error) {
      console.error("Error creating service:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to create service"));
    }
  }

  static async updateOrganizationService(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        service_data,
        is_public,
        allowed_client_ids,
        status,
        price,
        currency,
        category,
        service_key,
        // Image upload fields
        imageData,
        imageName,
        imageType,
      } = req.body;
      const { organizationId } = req;

      // First check if service exists and belongs to organization
      const checkQuery = `SELECT id FROM client_portal_services WHERE id = $1 AND organization_team_id = $2`;
      const checkResult = await db.query(checkQuery, [id, organizationId]);

      if (checkResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Service not found"));
      }

      // Validate service_key if provided
      let finalServiceKey: string | null | undefined = undefined;
      if (!organizationId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Organization ID is required"));
      }
      if (service_key !== undefined) {
        const keyValidation = await ClientPortalServicesController.validateServiceKey(
          service_key,
          organizationId,
          id
        );
        if (!keyValidation.isValid) {
          return res
            .status(400)
            .json(new ServerResponse(false, null, keyValidation.error || "Invalid service key"));
        }
        finalServiceKey = keyValidation.finalKey;
      }

      let finalServiceData = service_data ? { ...service_data } : undefined;

      // Handle image upload if provided
      if (imageData && imageName && imageType) {
        // Validate image
        const allowedImageTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
        ];
        if (!allowedImageTypes.includes(imageType)) {
          return res
            .status(400)
            .json(
              new ServerResponse(
                false,
                null,
                "Only JPEG, PNG, GIF, and WebP images are allowed"
              )
            );
        }

        // Validate file size (assuming base64 data) - 5MB limit
        const fileSizeBytes = Math.floor((imageData.length * 3) / 4);
        const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit

        if (fileSizeBytes > maxSizeBytes) {
          return res
            .status(400)
            .json(
              new ServerResponse(false, null, "Image size exceeds 5MB limit")
            );
        }

        // Generate unique filename and storage key
        const fileExtension = imageName.substring(imageName.lastIndexOf("."));
        const uniqueFileName = `service_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}${fileExtension}`;
        // Use getClientPortalStorageKey to ensure files are stored under organizations/{orgId}/client-portal/
        if (!organizationId) {
          return res
            .status(400)
            .json(new ServerResponse(false, null, "Organization ID is required"));
        }
        const storageKey = getClientPortalStorageKey("service-images", organizationId, uniqueFileName);

        try {
          // Upload to S3
          const imageUrl = await uploadBase64(imageData, storageKey);

          if (!imageUrl) {
            return res
              .status(500)
              .json(
                new ServerResponse(
                  false,
                  null,
                  "Failed to upload service image"
                )
              );
          }

          // Get current service data to check for existing images to clean up
          const currentServiceQuery = `SELECT service_data FROM client_portal_services WHERE id = $1`;
          const currentServiceResult = await db.query(currentServiceQuery, [
            id,
          ]);
          const currentServiceData =
            currentServiceResult.rows[0]?.service_data || {};
          const oldImageUrls = currentServiceData?.images || [];

          // Clean up old images from S3 (async, don't wait for completion)
          if (oldImageUrls.length > 0) {
            oldImageUrls.forEach(async (oldImageUrl: string) => {
              try {
                const urlParts = oldImageUrl.split("/");
                const storageKey = urlParts.slice(-4).join("/");

                await deleteObject(storageKey);
              } catch (deleteError) {
                console.error("Error deleting old service image:", {
                  oldImageUrl,
                  error: deleteError,
                });
              }
            });
          }

          // Use current service data as base if finalServiceData wasn't provided
          if (!finalServiceData) {
            finalServiceData = currentServiceData;
          }

          // Add new image URL to service data
          finalServiceData = {
            ...finalServiceData,
            images: [imageUrl],
          };
        } catch (uploadError) {
          console.error("Error uploading service image:", uploadError);
          return res
            .status(500)
            .json(
              new ServerResponse(false, null, "Failed to upload service image")
            );
        }
      }

      const updateFields = [];
      const queryParams = [];
      let paramCount = 0;

      if (name !== undefined) {
        paramCount++;
        updateFields.push(`name = $${paramCount}`);
        queryParams.push(name);
      }
      if (description !== undefined) {
        paramCount++;
        updateFields.push(`description = $${paramCount}`);
        queryParams.push(description);
      }
      if (finalServiceData !== undefined) {
        paramCount++;
        updateFields.push(`service_data = $${paramCount}`);
        queryParams.push(JSON.stringify(finalServiceData)); // Ensure proper JSON stringification
      }
      if (is_public !== undefined) {
        paramCount++;
        updateFields.push(`is_public = $${paramCount}`);
        queryParams.push(is_public);
      }
      if (allowed_client_ids !== undefined) {
        paramCount++;
        updateFields.push(`allowed_client_ids = $${paramCount}`);
        queryParams.push(allowed_client_ids);
      }
      if (status !== undefined) {
        paramCount++;
        updateFields.push(`status = $${paramCount}`);
        queryParams.push(status);
      }
      if (price !== undefined) {
        paramCount++;
        updateFields.push(`price = $${paramCount}`);
        queryParams.push(price);
      }
      if (currency !== undefined) {
        paramCount++;
        updateFields.push(`currency = $${paramCount}`);
        queryParams.push(currency);
      }
      if (category !== undefined) {
        paramCount++;
        updateFields.push(`category = $${paramCount}`);
        queryParams.push(category);
      }
      if (finalServiceKey !== undefined) {
        paramCount++;
        updateFields.push(`service_key = $${paramCount}`);
        queryParams.push(finalServiceKey);
      }

      if (updateFields.length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "No fields to update"));
      }

      // Add updated_at
      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      queryParams.push(new Date());

      // Add WHERE conditions
      paramCount++;
      queryParams.push(id);
      paramCount++;
      queryParams.push(organizationId);

      const updateQuery = `
        UPDATE client_portal_services
        SET ${updateFields.join(", ")}
        WHERE id = $${paramCount - 1} AND organization_team_id = $${paramCount}
        RETURNING *
      `;

      const result = await db.query(updateQuery, queryParams);
      const service = result.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: service.id,
            name: service.name,
            description: service.description,
            status: service.status,
            serviceData: service.service_data,
            isPublic: service.is_public,
            allowedClientIds: service.allowed_client_ids,
            price: service.price,
            currency: service.currency,
            category: service.category,
            serviceKey: service.service_key,
            createdAt: service.created_at,
            updatedAt: service.updated_at,
          },
          "Service updated successfully"
        )
      );
    } catch (error) {
      console.error("Error updating service:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update service"));
    }
  }

  static async deleteOrganizationService(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { organizationId } = req;

      // Check if service has any requests
      const requestsQuery = `SELECT COUNT(*) as count FROM client_portal_requests WHERE service_id = $1`;
      const requestsResult = await db.query(requestsQuery, [id]);
      const requestsCount = parseInt(requestsResult.rows[0].count);

      if (requestsCount > 0) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              `Cannot delete service with ${requestsCount} existing requests`
            )
          );
      }

      // Get service data before deletion to extract image URLs for cleanup
      const serviceQuery = `
        SELECT service_data
        FROM client_portal_services
        WHERE id = $1 AND organization_team_id = $2
      `;
      const serviceResult = await db.query(serviceQuery, [id, organizationId]);

      if (serviceResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Service not found"));
      }

      const serviceData = serviceResult.rows[0].service_data;
      const imageUrls = serviceData?.images || [];

      // Delete the service from database first
      const deleteQuery = `
        DELETE FROM client_portal_services
        WHERE id = $1 AND organization_team_id = $2
        RETURNING id
      `;

      const result = await db.query(deleteQuery, [id, organizationId]);

      if (result.rows.length === 0) {
        return res
          .status(500)
          .json(
            new ServerResponse(
              false,
              null,
              "Failed to delete service from database"
            )
          );
      }

      // Clean up images from S3 storage (async, don't wait for completion)
      if (imageUrls.length > 0) {
        imageUrls.forEach(async (imageUrl: string) => {
          try {
            // Extract storage key from URL
            // URL format: https://s3-bucket/{env}/organizations/{orgId}/client-portal/service-images/filename
            // or: https://s3-bucket/client-portal/service-images/orgId/filename (legacy)
            const urlParts = imageUrl.split("/");
            // Check if it's the new format (contains "organizations")
            const orgIndex = urlParts.findIndex(part => part === "organizations");
            let storageKey;
            if (orgIndex !== -1) {
              // New format: extract from organizations onwards
              storageKey = urlParts.slice(orgIndex).join("/");
            } else {
              // Legacy format: extract last 4 parts
              storageKey = urlParts.slice(-4).join("/");
            }

            await deleteObject(storageKey);
          } catch (deleteError) {
            console.error("Error deleting image from S3:", {
              imageUrl,
              error: deleteError,
            });
            // Don't fail the service deletion if image cleanup fails
          }
        });
      }

      return res.json(
        new ServerResponse(true, null, "Service deleted successfully")
      );
    } catch (error) {
      console.error("Error deleting service:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to delete service"));
    }
  }

}
