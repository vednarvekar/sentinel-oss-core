0️⃣ User Authentication Flow (ENTRY GATE)
	[ Browser ]
    |
    |  GET /login
    v
[ Redirect to GitHub OAuth ]
    |
    v
[ GitHub ]
    |
    |  callback ?code=
    v
[ Backend: /auth/github/callback ]
    |
    |-- exchange code → access_token
    |-- fetch GitHub user
    |-- upsert user in DB
    |-- create session
    |-- issue short-lived JWT
    v
[ Browser authenticated ]

	✅ From now on, every API assumes authenticated user
	❌ No GitHub API calls from frontend — EVER
	


1️⃣ Repo Search Flow
	
	[ Browser ]
    |
    |  GET /repos/search?q=react
    v
[ API ]
    |
    |-- check Redis cache
    |     |
    |     |-- HIT → return results
    |     |
    |     |-- MISS →
    |            |
    |            |-- enqueue repo_search job
    |            |-- return cached/stale/empty response

	Rules
		• Search is fast
		• Freshness is async
		• UI never blocks



2️⃣ Repo Open Flow (VERY IMPORTANT)
	
	[ Browser ]
    |
    |  GET /repos/:owner/:name
    v
[ API ]
    |
    |-- check DB (repo exists?)
    |     |
    |     |-- NO →
    |           |
    |           |-- enqueue repo_ingest job
    |           |-- return { status: "processing" }
    |
    |     |-- YES →
    |           |
    |           |-- return repo metadata

	Background: repo_ingest job
	
	[ Worker ]
    |
    |-- fetch repo metadata (GitHub API)
    |-- snapshot repo structure
    |-- analyze folder + file layout
    |-- store in DB
	👉 Repo page loads even if analysis is running
	


3️⃣ Issues List Flow
	
	[ Browser ]
    |
    |  GET /repos/:id/issues
    v
[ API ]
    |
    |-- check Redis cache
    |     |
    |     |-- HIT → return issues
    |     |
    |     |-- MISS →
    |            |
    |            |-- enqueue issue_ingest job
    |            |-- return cached / empty list

	Background: issue_ingest job
	
	[ Worker ]
    |
    |-- fetch issues from GitHub
    |-- normalize + store
    |-- mark stale/fresh
	


4️⃣ Issue Analysis Flow (CORE VALUE)
	
	[ Browser ]
    |
    |  GET /issues/:issue_id/analysis
    v
[ API ]
    |
    |-- check DB (analysis exists?)
    |     |
    |     |-- YES →
    |           |
    |           |-- return analysis
    |
    |     |-- NO →
    |           |
    |           |-- enqueue issue_analysis job
    |           |-- return { status: "pending" }

	Background: issue_analysis job
	
	[ Worker ]
    |
    |-- load repo structure
    |-- extract issue keywords
    |-- compute path relevance
    |-- compute difficulty score
    |-- generate explanation (templated)
    |-- store result
	Frontend polls or revalidates → analysis appears.
	
	5️⃣ Cache + Rate-Limit Flow (ALWAYS ACTIVE)
	
	[ Any GitHub API Call ]
    |
    |-- check rate limit state
    |     |
    |     |-- SAFE → proceed
    |     |
    |     |-- LOW → delay job
    |     |
    |     |-- ZERO → pause all GitHub jobs

	GitHub is never hit directly by UI.
	
	6️⃣ Error Handling Flow
	
	[ API / Worker ]
    |
    |-- failure?
          |
          |-- retry (with backoff)
          |
          |-- log error
          |
          |-- mark data as degraded
	User sees:
	
	"Analysis unavailable (retrying)"
	NOT crashes. NOT silence.
