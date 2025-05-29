import session from "express-session";
import db from "../config/db";
import { isProduction } from "../shared/utils";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pgSession = require("connect-pg-simple")(session);

// Test database connection and pg_sessions table
async function testSessionStore() {
  try {
    console.log("=== SESSION STORE DEBUG ===");
    
    // Test basic database connection
    const testQuery = await db.query("SELECT NOW() as current_time");
    console.log("Database connection test:", testQuery.rows[0]);
    
    // Check if pg_sessions table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'pg_sessions'
      ) as table_exists
    `);
    console.log("pg_sessions table exists:", tableCheck.rows[0].table_exists);
    
    if (tableCheck.rows[0].table_exists) {
      // Check table structure
      const structureQuery = await db.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'pg_sessions'
        ORDER BY ordinal_position
      `);
      console.log("pg_sessions table structure:", structureQuery.rows);
      
      // Check current sessions count
      const countQuery = await db.query("SELECT COUNT(*) as session_count FROM pg_sessions");
      console.log("Current sessions in database:", countQuery.rows[0].session_count);
      
      // Check recent sessions
      const recentQuery = await db.query(`
        SELECT sid, expire, created_at 
        FROM pg_sessions 
        ORDER BY created_at DESC 
        LIMIT 3
      `);
      console.log("Recent sessions:", recentQuery.rows);
    } else {
      console.log("ERROR: pg_sessions table does not exist!");
      
      // Try to create the table
      console.log("Attempting to create pg_sessions table...");
      await db.query(`
        CREATE TABLE IF NOT EXISTS pg_sessions (
          sid VARCHAR NOT NULL COLLATE "default",
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL,
          created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
        )
        WITH (OIDS=FALSE);
        
        ALTER TABLE pg_sessions ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
        CREATE INDEX IF NOT EXISTS IDX_session_expire ON pg_sessions (expire);
      `);
      console.log("pg_sessions table created successfully");
    }
    
    console.log("=== END SESSION STORE DEBUG ===");
  } catch (error) {
    console.log("Session store test error:", error);
  }
}

// Run the test
testSessionStore();

const store = new pgSession({
  pool: db.pool,
  tableName: "pg_sessions"
});

// Add store event listeners
store.on("connect", () => {
  console.log("Session store connected to database");
});

store.on("disconnect", () => {
  console.log("Session store disconnected from database");
});

// Override store methods to add debugging
const originalSet = store.set.bind(store);
const originalGet = store.get.bind(store);

store.set = function(sid: string, session: any, callback: any) {
  console.log(`=== SESSION SET ===`);
  console.log(`Session ID: ${sid}`);
  console.log(`Session data:`, JSON.stringify(session, null, 2));
  
  return originalSet(sid, session, (err: any) => {
    if (err) {
      console.log(`Session SET ERROR for ${sid}:`, err);
    } else {
      console.log(`Session SET SUCCESS for ${sid}`);
    }
    callback && callback(err);
  });
};

store.get = function(sid: string, callback: any) {
  console.log(`=== SESSION GET ===`);
  console.log(`Requesting session ID: ${sid}`);
  
  return originalGet(sid, (err: any, session: any) => {
    if (err) {
      console.log(`Session GET ERROR for ${sid}:`, err);
    } else if (session) {
      console.log(`Session GET SUCCESS for ${sid}:`, JSON.stringify(session, null, 2));
    } else {
      console.log(`Session GET: No session found for ${sid}`);
    }
    callback(err, session);
  });
};

export default session({
  name: process.env.SESSION_NAME,
  secret: process.env.SESSION_SECRET || "development-secret-key",
  proxy: false,
  resave: true,
  saveUninitialized: false,
  rolling: true,
  store,
  cookie: {
    path: "/",
    httpOnly: true,
    secure: false,
    // sameSite: "none",
    // domain: isProduction() ? ".worklenz.com" : undefined,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
});