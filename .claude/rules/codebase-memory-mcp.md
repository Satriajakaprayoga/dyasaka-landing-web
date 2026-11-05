# Rule: Use codebase-memory-mcp BEFORE file search or project analysis

Project graph name: **`dyasaka`** (root: `/data/dyasaka`).

## When this rule applies

Apply whenever the task involves ANY of the following — before touching Glob/Grep/Read for discovery:

- Finding where a feature, symbol, route, or component lives
- "Who calls X?" / "What does X call?" / impact analysis
- Understanding architecture, data flow, or relationships between features
- Analyzing a domain (e.g. "which features touch the ledger?")
- Answering open-ended "how does X work?" questions

## Tool mapping (graph first)

| Intent | Use INSTEAD of direct search |
|---|---|
| Find symbols by meaning/name | `search_graph` (BM25) |
| Find literal strings / regex in code | `search_code` (graph-ranked, supports `path_filter`) |
| Trace callers/callees, data flow | `trace_path` |
| Multi-hop, aggregation, complexity | `query_graph` (Cypher) |
| Architecture / structure overview | `get_architecture` |
| Read a known symbol's source | `get_code_snippet` (qualified name) |
| Outline of one exact file | `get_file_outline` |
| Verify a cited path exists in index | `check_index_coverage` |

Do NOT guess file paths and do NOT spray Grep across the repo when a graph tool can answer.

## Allowed fallback to Glob / Grep / Read

Fall back to direct file tools ONLY when:

1. The exact path or literal is already known and it is a needle query (read/edit a specific file).
2. `search_graph` / `search_code` return nothing useful — first run `check_index_coverage`; if the target is a coverage gap, search files directly and consider re-indexing.
3. Target is non-symbol content: config, `.env`, lockfiles, images, raw SQL outside indexed migrations, docs with unusual formatting.

## Index freshness

- The index does NOT auto-watch this project outside its MCP session. After code changes (especially after large edits, migrations, or before starting a new analysis task), refresh with:
  `index_repository(repo_path: "/data/dyasaka", name: "dyasaka", mode: "full")`
- If graph results look stale or miss recently changed code, re-index before concluding "doesn't exist".

## Accuracy

- The graph is best-effort: verify any cited `file:line` with Read before editing code.
- SQL/plpgsql migrations are partially parsed — confirm DB schema claims against migration files when precision matters.
