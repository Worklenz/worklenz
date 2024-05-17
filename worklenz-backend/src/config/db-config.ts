export default {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: +(process.env.DB_PORT as string),
  max: +(process.env.DB_MAX_CLIENTS as string),
  idleTimeoutMillis: 30000,
};
