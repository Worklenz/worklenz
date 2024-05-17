const policies = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "data:",
    "'unsafe-inline'",
    "https://js.usemessages.com",
    "https://*.tiny.cloud",
  ],
  "media-src": [
    "https://s3.us-west-2.amazonaws.com"
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'",
    "data:",
    "https://cdnjs.cloudflare.com",
    "https://fonts.googleapis.com",
    "https://*.tiny.cloud",
  ],
  "font-src": [
    "'self'",
    "data:",
    "https://fonts.gstatic.com",
    "https://cdnjs.cloudflare.com",
  ],
  "worker-src": ["'self'"],
  "connect-src": [
    "'self'",
    "data",
    "https://js.usemessages.com",
    "https://cdnjs.cloudflare.com",
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
    "https://s3.us-west-2.amazonaws.com",
    "https://s3.scriptcdn.net",
    "https://*.tiny.cloud",
    "https://*.tinymce.com",
  ],
  "img-src": [
    "'self'",
    "data:",
    "https://s3.us-west-2.amazonaws.com",
    "https://*.tinymce.com",
  ],
  "frame-src": ["https://docs.google.com"],
  "frame-ancestors": ["'none'"],
  "object-src": ["'none'"],
  "report-to": [`https://${process.env.HOSTNAME}/-/csp`]
};

const policyString = Object.entries(policies)
  .map(([key, value]) => `${key} ${value.join(" ")}`)
  .join("; ");

export const CSP_POLICIES = policyString;
