/**
 * Client Portal Helper Functions
 * Email templates, color utilities, and other shared helper functions
 */

import {
  IInvitationEmailData,
  IWelcomeEmailData,
  IOrganizationInvitationEmailData
} from "./interfaces";

/**
 * Generate HTML email template for client team member invitation
 */
export function generateInvitationEmailHTML(data: IInvitationEmailData): string {
  const expiryDate = data.expiresAt.toLocaleDateString();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You're Invited to Join ${data.clientName} on Worklenz</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1890ff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; background: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>You're Invited to Join ${data.clientName}</h1>
        </div>
        <div class="content">
          <p>Hello ${data.inviteeName},</p>
          <p>${data.inviterName} has invited you to join <strong>${data.clientName}</strong> on Worklenz as a <strong>${data.role}</strong>.</p>
          <p>Worklenz is a comprehensive project management platform that will help you collaborate effectively with your team and stay updated on project progress.</p>
          <p>Click the button below to accept the invitation and set up your account:</p>
          <a href="${data.inviteLink}" class="button">Accept Invitation</a>
          <p>This invitation will expire on ${expiryDate}.</p>
          <p>If you have any questions, please contact ${data.inviterName} or reply to this email.</p>
        </div>
        <div class="footer">
          <p>© 2024 Worklenz. All rights reserved.</p>
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML email template for welcome email after account creation
 */
export function generateWelcomeEmailHTML(data: IWelcomeEmailData): string {
  const primaryColor = "#1f2937";
  const hoverColor = "#111827";
  const mutedTextColor = "#4b5563";
  const subtleBackground = "#f9fafb";
  const subtleBorder = "#e5e7eb";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ${data.organizationName} on Worklenz</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #ffffff; color: ${primaryColor}; padding: 40px 20px; text-align: center; border-bottom: 2px solid ${subtleBorder}; }
        .header-logo { max-width: 120px; max-height: 60px; margin-bottom: 16px; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 40px 30px; background: white; }
        .content p { margin: 0 0 16px 0; font-size: 16px; }
        .content strong { color: ${primaryColor}; }
        .button { display: inline-block; background: transparent; color: ${primaryColor}; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 24px 0; font-weight: 600; font-size: 16px; border: 2px solid ${primaryColor}; transition: background-color 0.3s, border-color 0.3s; }
        .button:hover { background: ${subtleBackground}; border-color: ${hoverColor}; }
        .features { background: ${subtleBackground}; padding: 20px; border-radius: 6px; margin: 24px 0; border: 1px solid ${subtleBorder}; }
        .features h3 { margin: 0 0 12px 0; color: ${primaryColor}; font-size: 18px; }
        .features ul { margin: 0; padding-left: 20px; }
        .features li { margin: 8px 0; color: ${mutedTextColor}; }
        .footer { padding: 30px; text-align: center; color: #666; font-size: 14px; background: #f8f9fa; border-top: 1px solid #e8e8e8; }
        .footer p { margin: 8px 0; }
        .success-badge { background: ${subtleBackground}; border: 1px solid ${subtleBorder}; border-radius: 6px; padding: 16px; margin: 24px 0; text-align: center; }
        .success-badge p { margin: 0; color: ${primaryColor}; font-weight: 500; }
        @media (max-width: 600px) {
          .container { margin: 0; border-radius: 0; }
          .content { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${data.logoUrl ? `<img src="${data.logoUrl}" alt="${data.organizationName}" class="header-logo" />` : ''}
          <h1>Welcome to ${data.organizationName}!</h1>
        </div>
        <div class="content">
          <div class="success-badge">
            <p>🎉 Your account has been successfully created!</p>
          </div>

          <p>Hello ${data.userName},</p>

          <p>
            Welcome to <strong>${data.organizationName}</strong> on Worklenz!
          </p>

          <p>You now have access to a comprehensive project management platform where you can stay connected with your team and track project progress in real-time.</p>

          <div class="features">
            <h3>What you can do with your client portal:</h3>
            <ul>
              <li>View detailed project progress and milestones</li>
              <li>Submit new requests and track their status</li>
              <li>Access invoices and billing information</li>
              <li>Communicate with your team through integrated chat</li>
              <li>Manage your profile and notification preferences</li>
              <li>Download project deliverables and reports</li>
            </ul>
          </div>

          <p>Click the button below to access your client portal and start exploring:</p>

          <div style="text-align: center;">
            <a href="${data.portalLink}" class="button">Access Your Portal</a>
          </div>

          <p>If you have any questions about using your client portal or need assistance, please don't hesitate to reach out to your project team.</p>
        </div>
        <div class="footer">
          <p>© 2024 Worklenz. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML email template for organization invitation
 */
export function generateOrganizationInvitationEmailHTML(data: IOrganizationInvitationEmailData): string {
  const expiryDate = data.expiresAt.toLocaleDateString();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You're Invited to Join ${data.organizationName} on Worklenz</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1890ff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; background: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>You're Invited to Join ${data.organizationName}</h1>
        </div>
        <div class="content">
          <p>Hello ${data.inviteeName},</p>
          <p>${data.inviterName} has invited you to join <strong>${data.organizationName}</strong> on Worklenz.</p>
          <p>Click the button below to accept the invitation and access the client portal:</p>
          <a href="${data.inviteLink}" class="button">Accept Invitation</a>
          <p>This invitation will expire on ${expiryDate}.</p>
          <p>If you have any questions, please contact ${data.inviterName} or reply to this email.</p>
        </div>
        <div class="footer">
          <p>© 2024 Worklenz. All rights reserved.</p>
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Convert hex color code to RGB object
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convert RGB values to hex color code
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}

/**
 * Adjust brightness of a hex color by percentage
 * @param hex - Hex color code (e.g., "#FF0000")
 * @param percent - Percentage to adjust (-255 to +255)
 * @returns Adjusted hex color code
 */
export function adjustBrightness(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.max(0, Math.min(255, rgb.r + percent));
  const g = Math.max(0, Math.min(255, rgb.g + percent));
  const b = Math.max(0, Math.min(255, rgb.b + percent));

  return rgbToHex(r, g, b);
}

/**
 * Re-export slug utilities from shared utils
 */
export { generateUniqueSlug, suggestSlug, isValidSlug } from "../../../utils/slug";
