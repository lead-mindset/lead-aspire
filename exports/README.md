# LEAD Aspire Impact Report exports

Work in progress. The CSV list, data dictionary, validation results,
inconsistencies and data gaps are added in Step 4, after the queries have
been run against the live database.

- `SCHEMA_MAP.md`: tables, editions, what each column means, known gaps.
- `schema_check.sql`: confirms the live database matches the map.
- `aspire_exports.sql`: the export queries (read only).

## Excluded datasets

| Dataset | Why |
|---|---|
| Storage bucket `aspire-group-logos` and table `aspire_group_logos` | Team logos are not evidence of student work. Not exported, not used in the report. |
| Table `aspire_dallas_event_codes` | Holds the secret event code; not needed for the report. |
