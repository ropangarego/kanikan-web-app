# KANIKAN Release File Structure

Last updated: 2026-05-02

Target folder:

```text
D:\PROJECTS\KANIKAN
  bot\
  web-app\
  docs\
  db\
  backups\
```

## Active Files

Use these as active release files:

```text
docs\KANIKAN_SYSTEM_SOURCE_OF_TRUTH.md
docs\KANIKAN_USER_OPERATING_GUIDE.md
docs\KANIKAN_DEVELOPER_MAINTENANCE_GUIDE.md
db\01_schema_cleanup_v1_2026_04_28.sql
db\02_api_read_rpc_v1.sql
db\03_api_mutation_rpc_v1.sql
db\04_production_reset_seed_v1.sql
db\05_development_dummy_seed_v1.sql
web-app\
bot\
```

## Archived Files

Old blueprint, guide, work-in-progress JS, old SQL, and duplicate backups should live under:

```text
backups\release_cleanup_YYYYMMDD_HHMMSS\
```

Do not delete archives until the release is confirmed stable.

