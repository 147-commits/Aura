import { pool } from "./db";

/**
 * Single migration that creates ALL tables.
 * Idempotent — safe to run on every startup.
 * Uses UUID primary keys and proper foreign key constraints throughout.
 */
export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ─── Users ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Conversations ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT DEFAULT 'Aura Chat',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Messages ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content_plaintext TEXT,
        content_encrypted TEXT,
        is_encrypted BOOLEAN DEFAULT FALSE,
        type TEXT DEFAULT 'text',
        mode TEXT DEFAULT 'chat',
        confidence TEXT,
        explain_level TEXT DEFAULT 'normal',
        remember_flag BOOLEAN DEFAULT TRUE,
        is_private BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Memories ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS memories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plaintext TEXT,
        encrypted_text TEXT,
        is_encrypted BOOLEAN DEFAULT FALSE,
        category TEXT DEFAULT 'context',
        confidence TEXT DEFAULT 'High',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Citations ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS citations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title TEXT DEFAULT '',
        snippet TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Projects ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name_encrypted TEXT NOT NULL,
        description_encrypted TEXT DEFAULT '',
        is_encrypted BOOLEAN DEFAULT TRUE,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
        color TEXT DEFAULT '#3B82F6',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Tasks ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title_encrypted TEXT NOT NULL,
        description_encrypted TEXT DEFAULT '',
        is_encrypted BOOLEAN DEFAULT TRUE,
        status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
        due_date DATE,
        project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
        source_message_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Daily Plans ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_date DATE NOT NULL,
        summary_encrypted TEXT DEFAULT '',
        is_encrypted BOOLEAN DEFAULT TRUE,
        task_ids JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, plan_date)
      )
    `);

    // ─── Rate Limit Tracking ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        tokens_used INTEGER DEFAULT 0,
        request_count INTEGER DEFAULT 0,
        window_start TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, endpoint, window_start)
      )
    `);

    // ─── Crafts ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS crafts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
        kind TEXT NOT NULL,
        title_encrypted TEXT NOT NULL,
        is_encrypted BOOLEAN DEFAULT TRUE,
        content TEXT,
        file_path TEXT,
        filename TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Knowledge Chunks (RAG pipeline) ────────────────────────────────
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    } catch (e) {
      console.warn("pgvector extension not available — RAG features will be disabled:", (e as Error).message);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        content_embedding vector(1536),
        content_tsv tsvector,
        source_url TEXT,
        source_title TEXT,
        source_type TEXT NOT NULL DEFAULT 'user_provided',
        source_quality_score REAL DEFAULT 0.5,
        chunk_index INTEGER NOT NULL DEFAULT 0,
        parent_document_id TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Indexes ───────────────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rate_limits_user_window ON rate_limits(user_id, endpoint, window_start)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crafts_user_id ON crafts(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crafts_conversation_id ON crafts(conversation_id)`);
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks USING hnsw (content_embedding vector_cosine_ops)`);
    } catch { /* pgvector not available */ }
    await client.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tsv ON knowledge_chunks USING GIN (content_tsv)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_parent ON knowledge_chunks(parent_document_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source_type ON knowledge_chunks(source_type)`);

    await client.query("COMMIT");
    console.log("Database migration complete — all tables initialized");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Database migration failed:", err);
    throw err;
  } finally {
    client.release();
  }
}
