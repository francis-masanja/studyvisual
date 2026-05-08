import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_TURSO_URL || '';
const authToken = process.env.VITE_TURSOR_API_KEY || '';

if (!url || !authToken) {
  console.error("Please provide VITE_TURSO_URL and VITE_TURSOR_API_KEY in .env file");
  process.exit(1);
}

const client = createClient({
  url,
  authToken,
});

async function init() {
  try {
    console.log("Initializing database...");

    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        theme_preference TEXT DEFAULT 'cozy'
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT,
        type TEXT,
        content_json TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS progress (
        user_id TEXT,
        material_id TEXT,
        completion_percentage INTEGER,
        PRIMARY KEY (user_id, material_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (material_id) REFERENCES materials(id)
      );
    `);

    console.log("Database initialized successfully!");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

init();
