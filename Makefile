migrate:
	@for file in $$(ls api/migrations/*.sql | sort); do \
		echo "Applying $$file"; \
		cat $$file | docker exec -i sentinel-postgres psql -U sentinel -d sentinel; \
	done


migrate-create:
	@read -p "Migration name: " name; \
	ts=$$(date +%Y%m%d%H%M%S); \
	touch api/migrations/$$ts_$$name.sql; \
	echo "Created migration $$ts_$$name.sql"

# 1. Drops the tables (Clean)
db-clean:
	@echo "Dropping all tables..."
	@docker exec -i sentinel-postgres psql -U sentinel -d sentinel -c \
	"DROP TABLE IF EXISTS issue_analysis, repo_files, issues, sessions, repos, users CASCADE;"

# 2. Cleans AND then runs migrations (Fresh start)
db-reset: db-clean migrate
	@echo "Database has been reset and migrated."

db-status:
	@echo "Current tables in 'sentinel' database:"
	@docker exec -it sentinel-postgres psql -U sentinel -d sentinel -c "\dt"

### Command to check present tabels in db
# docker exec -it sentinel-postgres psql -U sentinel -d sentinel -c "\dt"