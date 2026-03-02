ALTER TABLE repo_files 
ADD COLUMN IF NOT EXISTS imports TEXT[],
ADD COLUMN IF NOT EXISTS urls TEXT[];

CREATE INDEX IF NOT EXISTS idx_repo_files_repo_id ON repo_files(repo_id);
