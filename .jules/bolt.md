## 2024-03-20 - SQLite `fetchall()` Memory Bottleneck on JSON Data
**Learning:** Fetching thousands of large JSON strings via `cursor.fetchall()` loads all records into memory at once, causing a significant memory spike before processing. For 10,000 JSON-parsed records, this approach consumes ~78% more peak memory compared to an iterative approach.
**Action:** Always iterate over the database cursor directly (`for row in cursor:`) or use `fetchmany()` when processing potentially large result sets, especially when the rows contain large structured data like JSON strings.
