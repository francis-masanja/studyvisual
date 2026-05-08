import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_TURSO_URL || process.env.TURSO_DATABASE_URL || '';
const authToken = process.env.VITE_TURSO_AUTH_TOKEN || process.env.VITE_TURSOR_API_KEY || process.env.TURSO_AUTH_TOKEN || '';

if (!url || !authToken) {
  console.error("Please provide database URL and Auth Token (VITE_ or standard TURSO_ names) in .env file");
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

    await client.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        category_id TEXT,
        user_id TEXT,
        question_text TEXT,
        options_json TEXT,
        correct_answer TEXT,
        rationale TEXT,
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS question_attempts (
        user_id TEXT,
        question_id TEXT,
        is_correct BOOLEAN,
        attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, question_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (question_id) REFERENCES questions(id)
      );
    `);

    // Add some default categories
    const initialCategories = ['Science', 'Technology', 'Engineering', 'Mathematics', 'Biology', 'Physics', 'History', 'Other'];
    for (const cat of initialCategories) {
      await client.execute({
        sql: "INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)",
        args: [Math.random().toString(36).substring(2, 10), cat]
      });
    }

    console.log("Database initialized successfully!");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

init();
