CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Repositories
CREATE TABLE IF NOT EXISTS repos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    default_branch TEXT,
    ingested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (owner, name)
);

-- 3. Repository Files (The Algorithm's Memory)
CREATE TABLE IF NOT EXISTS repo_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id UUID NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    extension TEXT,
    content TEXT, -- Stores the raw code
    last_fetched_at TIMESTAMPTZ, -- For stale check
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repo_id, path)
);

-- 4. Issues
CREATE TABLE IF NOT EXISTS issues (
    id BIGINT PRIMARY KEY, -- GitHub Global ID
    repo_id UUID REFERENCES repos(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state TEXT,
    labels JSONB,
    ingested_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- 5. Issue Analysis (The Brain's Output)
CREATE TABLE IF NOT EXISTS issue_analysis (
    issue_id BIGINT PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
    likely_paths JSONB, -- Dynamic list of verified matches
    difficulty TEXT,
    confidence_score FLOAT,
    explanation TEXT,
    analyzed_at TIMESTAMPTZ DEFAULT NOW()
);
