# DB Test Scripts

Purpose
- Non-destructive ORM write/read probe scripts for verifying major app models can be created and rolled back.

Files
- `db_main_test_v3.py`: Active, cleaned, deterministic script. Uses Django `transaction.savepoint()` then rolls back — safe for testing.
- `db_main_test_v2_archive.py`: Archive of older v2 heuristics (kept for reference).
- `last_run_output.txt`: Most recent run summary saved for auditing.

How to run (inside backend container)
```
docker compose run --rm backend bash -lc "python manage.py shell < scripts/db_tests/db_main_test_v3.py"
```

Notes
- Scripts are non-destructive by design: they create rows inside a savepoint and roll back.
- If you want to treat existing rows as acceptable (e.g. favorites/view history), consider modifying the script to `get_or_create()` rather than `create()`.
- `tmp/` is ignored by `.gitignore`; active scripts live under `scripts/db_tests/`.
