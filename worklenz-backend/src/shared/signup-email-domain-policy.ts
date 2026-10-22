import { domainToASCII } from "url";
import db from "../config/db";
import i18next from "../config/i18n";
import { signupEmailDomainPolicy } from "./private-extensions";

export const BLOCKED_SIGNUP_EMAIL_MESSAGE = "This email provider is not supported. Please use a different email address.";

export const getBlockedSignupEmailMessage = (language?: string): string => {
  const preferred = language?.split(",")[0]?.split(";")[0]?.trim().toLowerCase().split(/[-_]/)[0];
  return i18next.t("notifications:security.blockedSignupDomain", {
    lng: preferred === "sq" ? "alb" : preferred || "en",
    defaultValue: BLOCKED_SIGNUP_EMAIL_MESSAGE,
  });
};

/** Operator policy applies in OSS as well as alongside private extensions. */
export const isSignupEmailDomainBlocked = async (email: string): Promise<boolean> => {
  const separator = email.lastIndexOf("@");
  const domain = separator > 0
    ? domainToASCII(email.slice(separator + 1).trim().toLowerCase()).replace(/\.$/, "")
    : "";
  if (!domain) return signupEmailDomainPolicy.isBlocked(email);
  const result = await db.query(
    "SELECT 1 FROM blocked_signup_email_domains WHERE domain = $1 AND active = TRUE LIMIT 1;",
    [domain],
  );
  return Boolean(result.rowCount) || signupEmailDomainPolicy.isBlocked(email);
};
