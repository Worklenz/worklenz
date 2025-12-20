// csp.ts
const policies = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "data:",
    "'unsafe-inline'",
    "'unsafe-eval'", // Required for React development tools
    "https://*.tiny.cloud",
    "https://cdn.paddle.com",
    "https://sandbox-cdn.paddle.com",
    "https://www.google.com",
    "https://www.gstatic.com/recaptcha/",
    "https://www.google.com/recaptcha/",
    "localhost:3000", // React development server
    "localhost:*" // For webpack-dev-server
  ],
  "media-src": [
    "'self'",
    "https://s3.us-west-2.amazonaws.com"
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'",
    "data:",
    "https://cdnjs.cloudflare.com",
    "https://fonts.googleapis.com",
    "https://*.tiny.cloud",
    "https://cdn.paddle.com",
    "https://sandbox-cdn.paddle.com"
  ],
  "font-src": [
    "'self'",
    "data:",
    "https://fonts.gstatic.com",
    "https://fonts.googleapis.com",
    "https://cdnjs.cloudflare.com",
    "https://cdn.paddle.com",
    "https://sandbox-cdn.paddle.com",
    "https://*.autoarq.com.br"
  ],
  "worker-src": [
    "'self'",
    "blob:" // For React web workers
  ],
  "connect-src": [
    "'self'",
    "data:",
    "ws:", // For WebSocket connections
    "wss:", // For secure WebSocket connections
    "https://react.worklenz.com",
    "https://v2.worklenz.com",
    "https://dev.worklenz.com",
    "https://cdnjs.cloudflare.com",
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
    "https://worklenz.s3.amazonaws.com",
    "https://s3.us-west-2.amazonaws.com",
    "https://s3.scriptcdn.net",
    "https://*.tiny.cloud",
    "https://*.tinymce.com",
    "https://cdn.paddle.com",
    "https://sandbox-cdn.paddle.com",
    "wss://uat.app.worklenz.com",
    "wss://app.worklenz.com",
    "https://www.google.com",
    "https://www.gstatic.com",
    "https://*.autoarq.com.br",
    "localhost:*" // For development API calls
  ],
  "img-src": [
    "'self'",
    "data:",
    "blob:", // For React image processing
    "https://worklenz.s3.amazonaws.com",
    "https://s3.us-west-2.amazonaws.com",
    "https://*.tinymce.com",
    "https://cdn.paddle.com",
    "https://sandbox-cdn.paddle.com",
    "https://*.hsforms.com"
  ],
  "frame-src": [
    "'self'",
    "https://app.hubspot.com",
    "https://sandbox-buy.paddle.com",
    "https://buy.paddle.com",
    "https://docs.google.com",
    "https://www.google.com",
    "https://www.gstatic.com/recaptcha/",
    "https://www.google.com/recaptcha/"
  ],
  "frame-ancestors": ["'self'", "https://www.google.com"],
  "object-src": ["'none'"],
  "report-to": [`https://${process.env.HOSTNAME}/-/csp`]
};

// Helper function to conditionally add development-specific policies
const addDevPolicies = (currentPolicies: typeof policies) => {
  if (process.env.NODE_ENV !== "production") {
    return {
      ...currentPolicies,
      "script-src": [
        ...(currentPolicies["script-src"] || []),
        "'unsafe-eval'", // Required for React development tools
        "localhost:*"
      ],
      "connect-src": [
        ...(currentPolicies["connect-src"] || []),
        "ws://localhost:*", // For webpack-dev-server HMR
        "http://localhost:*" // For local development
      ]
    };
  }
  return currentPolicies;
};

const finalPolicies = addDevPolicies(policies);

const policyString = Object.entries(finalPolicies)
  .map(([key, value]) => `${key} ${value.join(" ")}`)
  .join("; ");

export const CSP_POLICIES = policyString;
