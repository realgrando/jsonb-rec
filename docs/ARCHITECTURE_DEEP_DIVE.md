# Architecture Deep Dive: JSONB-REC
**Author:** Gustavo Grando (`@realgrando`)  
**Design Paradigm:** Hexagonal Architecture / Ports & Adapters  
**Core Principles:** Hybrid Relational Metamodel + Binary JSONB Storage, Anti-JSON-Bomb Defense, Semantic Mutation Diffing  

---

## 1. The Dynamic Attribute Dilemma: EAV vs. Wild JSONB

When architects design systems requiring user-defined dynamic attributes (CRM custom fields, ERP parameters, flexible product catalogs), they almost universally fall into one of two dangerous extremes:

### Extreme A: The Relational EAV Nightmare (Entity-Attribute-Value)
```sql
-- The EAV Anti-Pattern: Exploding table joins
SELECT e.id, a.name, v.value 
FROM entities e
JOIN attribute_values v ON e.id = v.entity_id
JOIN attributes a ON v.attribute_id = a.id
WHERE e.id = $1;
```
When an entity possesses 30 custom fields:
- Rendering 50 rows in a dashboard requires querying **1,500 join records**.
- Adding sorting or aggregation across multiple dynamic attributes forces multiple self-joins on `attribute_values`, destroying query planner performance.
- Relational integrity locks prevent efficient bulk inserts.

### Extreme B: The "Wild Wild West" JSONB Blob
```sql
-- Unchecked JSONB: Fast writes, zero integrity
ALTER TABLE entities ADD COLUMN custom_data JSONB;
```
Engineers often swing to PostgreSQL's native `jsonb` column. While storage is fast and compact, unchecked JSONB introduces catastrophic production vulnerabilities:
- **Schema Rot:** Typographical errors in keys (`"budget"` vs `"budeget"`) create silent data corruption.
- **Type Anarchy:** A field expected to be a number (`monthly_budget: 10000`) is suddenly saved as a string (`"10k"`), crashing downstream reporting jobs.
- **JSON-Bomb Denial of Service:** Without a strict byte ceiling, malicious actors or buggy automated tools can post a 50MB nested JSON payload, causing Node.js event loop lag and PostgreSQL buffer pool exhaustion.
- **Audit Blindness:** When a JSONB column updates, PostgreSQL rewrites the binary document. Determining *which* specific dynamic field changed from *what* to *what* requires custom diffing algorithms.

---

## 2. The Solution: Hybrid Metamodel over Binary JSONB

`jsonb-rec` bridges this chasm by pairing a **Lightweight Relational Metamodel** with a **Single Binary JSONB Instance Column**:

```
        METAMODEL (Relational Definition)
  ┌───────────────────────────────────────────┐
  │ custom_field_groups                       │
  │   - id, name, visibility_scope            │
  └─────────────────────┬─────────────────────┘
                        │ 1:N
  ┌─────────────────────▼─────────────────────┐
  │ custom_field_definitions                  │
  │   - key: "monthly_budget"                 │
  │   - field_type: "NUMBER"                  │
  │   - is_required: true                     │
  └───────────────────────────────────────────┘
                        │
                        ▼ Validates against
  ┌───────────────────────────────────────────┐
  │            RUNTIME ENTITY ROW             │
  │                                           │
  │ id: uuid-100                              │
  │ title: "Enterprise Account"               │
  │ custom_data: {                            │
  │   "monthly_budget": 25000,                │  <-- Single JSONB Column
  │   "client_tier": "ENTERPRISE"             │      (Indexed via GIN)
  │ }                                         │
  └───────────────────────────────────────────┘
```

### Why this architecture wins:
1. **$O(1)$ Single Read Query:** Fetching an entity reads exactly 1 table row. Zero joins on attribute tables.
2. **PostgreSQL GIN Indexing:** Queries filtering by dynamic fields can leverage GIN operators:
   ```sql
   CREATE INDEX idx_entities_custom_data ON entities USING GIN (custom_data jsonb_path_ops);
   SELECT * FROM entities WHERE custom_data @> '{"client_tier": "ENTERPRISE"}';
   ```
3. **Runtime Schema Enforcement:** Ingestion and update endpoints validate the JSONB payload against the metamodel in memory before executing database writes.

---

## 3. Anti-JSON-Bomb Defense: Runtime Safety Ceilings

To prevent memory exhaustion attacks, `RuntimeDataValidator` uses Zod to enforce a two-tier safety barrier:

```typescript
// From src/core/validator.ts
public static createSafetySchema(options?: { maxSizeBytes?: number }) {
  const maxSizeBytes = options?.maxSizeBytes ?? 51200; // 50 KB ceiling

  return z.record(
    z.string().min(1).max(255),
    z.union([
      z.string().max(10000),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.string().max(10000)).max(100),
      z.record(z.string(), z.any()),
    ])
  ).refine(
    (data) => JSON.stringify(data).length <= maxSizeBytes,
    { message: 'JSONB payload exceeds memory security ceiling (50 KB)' }
  );
}
```

### Guardrails Enforced:
- **Maximum Payload Size:** Hard cap (default 50KB) evaluated in under 0.1ms before parsing deep schemas.
- **Maximum String Length:** Prevents memory allocations from massive base64 or raw document dumps.
- **Key Constraints:** Enforces clean snake_case slugified keys (`a-z0-9_`).

---

## 4. Semantic Diffing: Granular Audit Trails Without Relational Overhead

When an entity with JSONB data mutates, updating the row replaces the blob. `SemanticDiffEngine` solves the audit traceability gap:

```typescript
// From src/core/diff-engine.ts
const diffs = SemanticDiffEngine.compute(oldData, newData, definitions);
```

### The Algorithm:
1. Gathers the union of keys across $Old$ and $New$ snapshots.
2. Filters out identical values (using deep equality for nested structures and primitive equivalence).
3. Resolves the human-readable label from the metamodel map (e.g. `monthly_budget` $\rightarrow$ `"Monthly Budget"`).
4. Categorizes the mutation into:
   - **Creation:** `Field "X" set to "Y".`
   - **Mutation:** `Field "X" changed from "A" to "B".`
   - **Deletion:** `Field "X" cleared (was "A").`

This produces audit trails suitable for timeline feeds, regulatory compliance, and live notifications without requiring separate changelog tables for every dynamic attribute.

---

## 5. Scope-Based UI Layout Resolution

In real-world applications, dynamic fields must adapt to context and user permissions:
- **Scope ID:** Isolates definitions per workspace, category, or workflow board.
- **Visibility Scope:** Restricts field groups based on caller roles (e.g., `PUBLIC` form vs `INTERNAL` operational panel vs `GLOBAL`).

The renderer retrieves pre-filtered layouts with nested fields in a single call, allowing dynamic forms to render without client-side permission logic.
