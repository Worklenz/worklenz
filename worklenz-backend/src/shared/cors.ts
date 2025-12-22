import { isProduction } from "./utils";

const allowedOriginRegex = /^https:\/\/([a-z0-9-]+\.)?autoarq\.com\.br$/;

const localOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
  "http://localhost:5000"
];

export const getAllowedOrigins = () => {
  const envOrigins = [
    process.env.SERVER_CORS || "",
    process.env.FRONTEND_URL || "",
    process.env.SOCKET_IO_CORS || ""
  ].filter(Boolean);

  return (isProduction() ? envOrigins : [...localOrigins, ...envOrigins]).filter(Boolean);
};

export const isOriginAllowed = (origin?: string | null) => {
  if (!origin) return true;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin) || allowedOriginRegex.test(origin);
};
