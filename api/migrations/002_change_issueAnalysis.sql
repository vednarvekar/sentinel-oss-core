ALTER TABLE issue_analysis 
ADD COLUMN IF NOT EXISTS suggested_fix TEXT,
ADD COLUMN IF NOT EXISTS ai_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_issue_analysis_issue_id ON issue_analysis(issue_id);