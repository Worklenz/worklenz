import { acceptInviteWhileSignedIn, requestSignInCode, verifySignInCode } from "../../../services/client-portal-v2/sign-in.service";
import { PortalError } from "../../../services/client-portal-v2/errors";
import { asString, bodyOf, ok, portalHandler } from "./portal-http";

/**
 * Client sign-in with a one-time emailed code. Both routes are public: the caller has no token yet.
 * Bodies and responses are camelCase like the rest of the client API.
 */
export default class ClientSignInController {
  /** Sends a code to the address in the invitation link (`inviteToken`) or to the typed `email`. */
  static requestCode = portalHandler("Failed to send the sign-in code", async (req, res) => {
    const body = bodyOf(req);
    const result = await requestSignInCode({
      email: asString(body.email),
      inviteToken: asString(body.inviteToken),
      ip: req.ip ?? null,
    });

    ok(
      res,
      {
        email: result.email,
        maskedEmail: result.masked_email,
        expiresInSeconds: result.expires_in_seconds,
        resendAfterSeconds: result.resend_after_seconds,
        organizationName: result.organization_name,
      },
      "If this email has portal access, a sign-in code is on its way."
    );
  });

  /** Checks the code and answers with the same session body the old password sign-in did. */
  static verifyCode = portalHandler("Failed to sign in", async (req, res) => {
    const body = bodyOf(req);
    const session = await verifySignInCode({
      email: asString(body.email) ?? "",
      code: asString(body.code) ?? "",
    });

    ok(res, session, "Login successful");
  });

  /**
   * Accepts an invitation link for someone who is already signed in: no code. Authenticated like the
   * rest of the client API, and the invitation must be for the address the session belongs to.
   */
  static acceptInvite = portalHandler("Failed to accept the invitation", async (req, res) => {
    const body = bodyOf(req);
    const { clientUserId, clientEmail } = req as unknown as { clientUserId?: string; clientEmail?: string };
    const inviteToken = asString(body.inviteToken);
    if (!clientUserId || !clientEmail || !inviteToken) {
      throw new PortalError(400, "An invitation link is required.", "LINK_INVALID");
    }

    const joined = await acceptInviteWhileSignedIn({ clientUserId, sessionEmail: clientEmail, inviteToken });
    ok(res, joined, "Invitation accepted");
  });
}
