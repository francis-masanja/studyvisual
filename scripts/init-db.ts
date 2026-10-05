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
        material_id TEXT,
        visibility TEXT DEFAULT 'community',
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    const questionColumns = await client.execute('PRAGMA table_info(questions)');
    const existingColumns = new Set(questionColumns.rows.map(row => String(row.name)));
    if (!existingColumns.has('material_id')) {
      await client.execute('ALTER TABLE questions ADD COLUMN material_id TEXT');
    }
    if (!existingColumns.has('visibility')) {
      await client.execute("ALTER TABLE questions ADD COLUMN visibility TEXT DEFAULT 'community'");
    }

    const unlinked = await client.execute('SELECT id FROM questions WHERE material_id IS NULL');
    const unlinkedIds = new Set(unlinked.rows.map(row => String(row.id)));
    if (unlinkedIds.size > 0) {
      const materialsForBackfill = await client.execute('SELECT id, content_json FROM materials');
      const pairs: Array<[string, string]> = [];
      for (const row of materialsForBackfill.rows) {
        let cards: Array<{ id?: unknown }> = [];
        try {
          const parsed = JSON.parse(String(row.content_json ?? '{}')) as { cards?: Array<{ id?: unknown }> };
          cards = Array.isArray(parsed.cards) ? parsed.cards : [];
        } catch {
          continue;
        }
        for (const card of cards) {
          if (!card || typeof card.id !== 'string' || !unlinkedIds.has(card.id)) continue;
          pairs.push([card.id, String(row.id)]);
        }
      }
      let linkedQuestions = 0;
      for (let i = 0; i < pairs.length; i += 100) {
        const chunk = pairs.slice(i, i + 100);
        const update = await client.execute({
          sql: `UPDATE questions SET material_id = CASE id ${chunk.map(() => 'WHEN ? THEN ?').join(' ')} END WHERE id IN (${chunk.map(() => '?').join(', ')})`,
          args: [...chunk.flatMap(([questionId, materialId]) => [questionId, materialId]), ...chunk.map(([questionId]) => questionId)]
        });
        linkedQuestions += update.rowsAffected;
      }
      if (linkedQuestions > 0) {
        console.log(`Linked ${linkedQuestions} question(s) back to their material(s).`);
      }
    }

    await client.execute(
      'DELETE FROM question_attempts WHERE question_id IN (SELECT id FROM questions WHERE material_id IS NOT NULL AND material_id NOT IN (SELECT id FROM materials))'
    );
    const orphanedQuestions = await client.execute(
      'DELETE FROM questions WHERE material_id IS NOT NULL AND material_id NOT IN (SELECT id FROM materials)'
    );
    if (orphanedQuestions.rowsAffected > 0) {
      console.log(`Removed ${orphanedQuestions.rowsAffected} orphaned question(s) from deleted materials.`);
    }

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

    // Account-synced score/streak (survives localStorage clears and devices)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id TEXT PRIMARY KEY,
        score INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        last_played TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // In-progress daily challenge so a reload resumes where the user stopped
    await client.execute(`
      CREATE TABLE IF NOT EXISTS challenge_sessions (
        user_id TEXT,
        day TEXT,
        question_ids TEXT,
        answers TEXT,
        current_index INTEGER DEFAULT 0,
        finished INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, day),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // Per-material quiz card results, synced to the account
    await client.execute(`
      CREATE TABLE IF NOT EXISTS quiz_results (
        user_id TEXT,
        material_id TEXT,
        results_json TEXT,
        PRIMARY KEY (user_id, material_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // Add some default categories
    const initialCategories = [
      'Operating Systems',
      'Computer Architecture & Embedded Systems',
      'Data Structures & Algorithms',
      'Programming & Languages',
      'Computer Networks',
      'Cyber Security',
      'Artificial Intelligence',
      'Indian Knowledge System',
      'Mathematics',
      'General Knowledge',
    ];
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
