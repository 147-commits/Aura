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
        last_memory_consolidation TIMESTAMPTZ,
        memory_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Add columns for existing installations
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_memory_consolidation TIMESTAMPTZ`).catch(() => {});
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS memory_count INTEGER DEFAULT 0`).catch(() => {});
    // Subscription tier — used by the concurrency guard. Defaults to 'free'.
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free'`).catch(() => {});
    // Postgres doesn't support ADD CONSTRAINT IF NOT EXISTS. Wrap in a DO
    // block so a repeat run is a no-op rather than aborting the outer tx.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_tier_check'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT users_tier_check CHECK (tier IN ('free','paid','enterprise'));
        END IF;
      END $$;
    `);

    // Conversation branching support
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_message_id UUID`).catch(() => {});
    await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS parent_conversation_id UUID`).catch(() => {});
    await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS branch_point_message_id UUID`).catch(() => {});

    // Project connections — link conversations, crafts, and memories to projects
    await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL`).catch(() => {});
    await client.query(`ALTER TABLE crafts ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL`).catch(() => {});
    await client.query(`ALTER TABLE memories ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL`).catch(() => {});
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT ''`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id) WHERE project_id IS NOT NULL`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_crafts_project ON crafts(project_id) WHERE project_id IS NOT NULL`).catch(() => {});

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

    // ─── User Feedback ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_id UUID,
        conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
        rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── Builder Projects ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS builder_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL DEFAULT 'website',
        name TEXT NOT NULL,
        files JSONB DEFAULT '{}',
        current_html TEXT,
        deploy_url TEXT,
        conversation_id UUID REFERENCES conversations(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id)`);
    // ─── MCP Connections ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcp_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        server_name TEXT NOT NULL,
        server_url TEXT NOT NULL,
        transport TEXT DEFAULT 'sse',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_mcp_connections_user_id ON mcp_connections(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_builder_projects_user_id ON builder_projects(user_id)`);

    // ─── Orchestrator: concurrency guard ───────────────────────────────
    // Each row = one in-flight pipeline run. Concurrency guard counts rows
    // per user_id before inserting a new one.
    await client.query(`
      CREATE TABLE IF NOT EXISTS active_runs (
        run_id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        org_id UUID,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        status TEXT DEFAULT 'running'
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_active_runs_user ON active_runs(user_id)`);

    // ─── Orchestrator: prompt versioning ───────────────────────────────
    // Snapshot of every agent's systemPrompt at a given AgentDefinition.promptVersion.
    // Populated by scripts/snapshot-prompts.ts. Replays look up (agent_id, version)
    // here rather than reading the current registry, so old runs stay reproducible
    // across prompt edits.
    await client.query(`
      CREATE TABLE IF NOT EXISTS prompt_versions (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL,
        version TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(agent_id, version)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent ON prompt_versions(agent_id)`);

    // ─── Orchestrator: run steps ───────────────────────────────────────
    // One row per agent invocation inside a run. prompt_version is stamped
    // at invocation time so replays can re-hydrate the exact prompt used.
    await client.query(`
      CREATE TABLE IF NOT EXISTS run_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL,
        agent_id TEXT NOT NULL,
        step_index INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        input_payload JSONB,
        output_payload JSONB,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        ended_at TIMESTAMPTZ,
        tokens_in INTEGER DEFAULT 0,
        tokens_out INTEGER DEFAULT 0,
        cost_usd NUMERIC(10, 6) DEFAULT 0,
        error_message TEXT
      )
    `);
    // Prompt version column — separate ALTER so pre-F5 installations pick it up.
    await client.query(`ALTER TABLE run_steps ADD COLUMN IF NOT EXISTS prompt_version TEXT`).catch(() => {});
    await client.query(`ALTER TABLE run_steps ADD COLUMN IF NOT EXISTS latency_ms INTEGER`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_run_steps_run ON run_steps(run_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_run_steps_agent ON run_steps(agent_id)`);

    // ─── Orchestrator: canonical pipeline run record ───────────────────
    // The persistent record of every Virtual Company Engine run. Separate
    // from active_runs (which is the transient concurrency-guard table).
    await client.query(`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        run_id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        org_id UUID,
        status TEXT NOT NULL DEFAULT 'running',
        delivery_option TEXT,
        budget_json JSONB NOT NULL DEFAULT '{}',
        prompt_version_set JSONB NOT NULL DEFAULT '{}',
        input_brief_encrypted TEXT,
        input_brief_is_encrypted BOOLEAN DEFAULT TRUE,
        total_cost_usd NUMERIC(10, 6) DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pipeline_runs_user ON pipeline_runs(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pipeline_runs_org ON pipeline_runs(org_id) WHERE org_id IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status)`);

    // ─── Orchestrator: artifacts produced by agent steps ──────────────
    // Payload encrypted at rest; embedding stored unencrypted for similarity
    // search (semantic-only, not literal-text leakage). quality_score +
    // rubric_id come from the F4 evaluator after a gate runs.
    await client.query(`
      CREATE TABLE IF NOT EXISTS run_artifacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL,
        step_id UUID,
        org_id UUID,
        artifact_type TEXT NOT NULL,
        title TEXT,
        payload_encrypted TEXT NOT NULL,
        is_encrypted BOOLEAN DEFAULT TRUE,
        embedding vector(1536),
        quality_score REAL,
        rubric_id TEXT,
        evaluator_id TEXT,
        confidence_level TEXT,
        confidence_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_run_artifacts_run ON run_artifacts(run_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_run_artifacts_org ON run_artifacts(org_id) WHERE org_id IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_run_artifacts_type ON run_artifacts(artifact_type)`);
    try {
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_run_artifacts_embedding ON run_artifacts USING hnsw (embedding vector_cosine_ops)`
      );
    } catch { /* pgvector hnsw not available */ }

    // ─── Orchestrator: gate decisions per phase ───────────────────────
    // GateResult shape matches F6's GateResultSchema.
    await client.query(`
      CREATE TABLE IF NOT EXISTS gate_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL,
        step_id UUID,
        gate_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        passed BOOLEAN NOT NULL,
        requires_human_review BOOLEAN NOT NULL DEFAULT FALSE,
        confidence_level TEXT NOT NULL,
        confidence_reason TEXT,
        checks_json JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_gate_results_run ON gate_results(run_id)`);

    // ─── Orchestrator: tool invocations ───────────────────────────────
    // input/output stored encrypted (may carry sensitive data).
    await client.query(`
      CREATE TABLE IF NOT EXISTS tool_calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL,
        step_id UUID,
        agent_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        input_encrypted TEXT,
        output_encrypted TEXT,
        is_encrypted BOOLEAN DEFAULT TRUE,
        duration_ms INTEGER,
        cost_usd NUMERIC(10, 6) DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tool_calls_run ON tool_calls(run_id)`);

    // ─── Orchestrator: routing decisions (audit trail) ────────────────
    // AgentDecision shape matches F6's AgentDecisionSchema. question / decision /
    // reasoning may quote user content; encrypted at rest.
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_decisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL,
        question_encrypted TEXT NOT NULL,
        decision_encrypted TEXT NOT NULL,
        reasoning_encrypted TEXT NOT NULL,
        is_encrypted BOOLEAN DEFAULT TRUE,
        confidence_level TEXT NOT NULL,
        confidence_reason_encrypted TEXT,
        reversible BOOLEAN NOT NULL DEFAULT TRUE,
        decided_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_decisions_run ON agent_decisions(run_id)`);

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
