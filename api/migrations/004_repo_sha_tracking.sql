ALTER TABLE repos
ADD COLUMN IF NOT EXISTS last_head_sha TEXT,
ADD COLUMN IF NOT EXISTS last_tree_sha TEXT;

ALTER TABLE repo_files
ADD COLUMN IF NOT EXISTS sha TEXT;

CREATE INDEX IF NOT EXISTS idx_repo_files_repo_id_sha ON repo_files(repo_id, sha);
