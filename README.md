# jsonb-rec

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict%205.7-blue.svg)](https://www.typescriptlang.org/)
[![Architecture: Hexagonal](https://img.shields.io/badge/Architecture-Ports%20%26%20Adapters-emerald.svg)](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software))
[![Tests: Vitest](https://img.shields.io/badge/Tests-Vitest%20Passed-brightgreen.svg)](https://vitest.dev/)

> **Architectural Context & Origin**  
> I originally architected this dynamic data engine inside **`nivix-os`**, the proprietary operating monolith of [Nivix Company](https://github.com/nivix-company). In our multi-tenant operations, enterprise clients required custom dynamic data fields across commercial and operational pipelines. Building an Entity-Attribute-Value (EAV) schema resulted in severe query performance degradation due to exponential table joins, while relying on raw, unvalidated JSONB led to payload pollution, memory exhaustion risks (JSON bombs), and the complete loss of granular audit tracking.  
> To solve this, I designed a hybrid paradigm: a lightweight relational metamodel paired with single-column binary JSONB storage, enforced at runtime via strict Zod validation guards and backed by a Semantic Diffing Engine for human-readable audit trails. This repository is a sanitized, open-core extraction of that architecture, published as a reference implementation using the Hexagonal (Ports & Adapters) pattern.

---

## The Architectural Problem: EAV Join Hell vs. Wild JSONB

When building applications with user-defined dynamic attributes, engineering teams typically choose between two flawed approaches:

1. **The Relational EAV Anti-Pattern:** Creating separate `attribute_definitions` and `attribute_values` tables. Querying 50 entities with 20 custom attributes requires joining 1,000 rows, destroying PostgreSQL query planner cache and preventing simple index scans.
2. **The "Wild Wild West" JSONB Blob:** Adding an untyped `custom_data jsonb` column. Without strict boundaries, misspelled keys, invalid types, and massive payloads (JSON bombs) enter the database, corrupting state and exhausting server memory.
3. **The Audit Blindness Anomaly:** When a JSONB document updates, the entire binary blob is overwritten. Relational databases cannot natively determine *which* dynamic attribute changed, requiring tedious manual logging.

---

## The Engineering Solution

`jsonb-rec` solves this dilemma through three complementary mechanisms:

### 1. Hybrid Storage Paradigm
- **Metamodel in Relational Tables:** Custom field definitions (types, options, required flags, layout positions) are stored in clean relational tables.
- **Data in Binary JSONB:** Entity instances store dynamic values in a single `custom_data jsonb` column, queryable via PostgreSQL GIN indexes in $O(1)$ read time without joins.

### 2. Anti-JSON-Bomb Runtime Validation
Before any write reaches the database, the payload passes through `RuntimeDataValidator`:
- Enforces an absolute byte ceiling (default 50KB) to prevent memory exhaustion attacks.
- Validates data types (`NUMBER`, `TEXT`, `DATE`, `SELECT`, `BOOLEAN`, `ARRAY`) and option constraints.
- Rejects malformed structures before triggering database transactions.

### 3. Semantic Diffing Engine
When updating an entity, `SemanticDiffEngine` compares the previous and incoming JSONB documents against the metamodel:
- Produces clean, human-readable change logs (e.g. `Field "Monthly Budget" changed from "15000" to "25000"`).
- Enables timeline audit feeds without storing redundant attribute history rows.

---

## Core Architecture & Design Patterns

The module is structured under **Hexagonal Architecture (Ports and Adapters)**:

```
                      [Incoming Entity Payload]
                                 │
                                 ▼
        ┌──────────────────────────────────────────────────┐
        │                 JsonbRecEngine                   │
        │             (Core Validation & Diff)             │
        └────────────────────────┬─────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
 ┌─────────────────────────┐           ┌─────────────────────────┐
 │   RuntimeDataValidator  │           │   SemanticDiffEngine    │
 │  - Anti-JSON-Bomb check │           │  - Old vs New compare   │
 │  - Type & Option checks │           │  - Label resolution     │
 │  - Byte ceiling (<50KB) │           │  - Descriptive logs     │
 └─────────────────────────┘           └─────────────────────────┘
                                 │
                                 ▼
        ┌──────────────────────────────────────────────────┐
        │            IFieldSchemaStorageDriver             │
        │         (Metamodel Persistence Port)             │
        └────────────────────────┬─────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
 ┌─────────────────────────┐           ┌─────────────────────────┐
 │InMemoryFieldSchemaStore │           │DrizzleFieldSchemaStorage│
 │  (Zero-deps, in-memory) │           │  (PostgreSQL Schemas)   │
 └─────────────────────────┘           └─────────────────────────┘
```

---

## Engineering Rationale

- **Pure TypeScript Core:** Zero external dependencies for the diffing and validation engines.
- **PostgreSQL GIN Compatibility:** Designed to pair seamlessly with `jsonb_path_ops` for fast JSONB querying.
- **NestJS Decorator:** Ships with `@IsStrictJsonbData()` for plug-and-play integration with NestJS DTO validation pipelines.

---

## Architectural Usage

### 1. Standalone / Zero-Dependency Mode

```typescript
import { 
  JsonbRecEngine, 
  InMemoryFieldSchemaStorage 
} from './src';

const storage = new InMemoryFieldSchemaStorage();
const engine = new JsonbRecEngine({ storageDriver: storage });

// 1. Register a dynamic schema
const group = await engine.registerGroup({ name: 'Commercial Terms', visibilityScope: 'GLOBAL', displayOrder: 1 });
await engine.registerField({
  groupId: group.id,
  name: 'Contract Value',
  fieldType: 'NUMBER',
  isRequired: true,
  position: 1,
});

// 2. Validate payload at runtime
const validation = await engine.validate({ contract_value: 25000 });
console.log(validation.isValid); // true

// 3. Compute audit diff
const diffs = await engine.computeDiff(
  { contract_value: 20000 },
  { contract_value: 25000 }
);
console.log(diffs[0].description); // 'Field "Contract Value" changed from "20000" to "25000".'
```

### 2. NestJS DTO Decorator Integration

```typescript
import { IsStrictJsonbData } from './src';

export class UpdateLeadDto {
  @IsStrictJsonbData()
  customData?: Record<string, unknown>;
}
```

---

## Running the Simulation Locally

The repository includes a runnable, self-contained terminal simulation executing:
- **Scenario 1:** Dynamic metamodel registration with deterministic key slugification.
- **Scenario 2:** Anti-JSON-Bomb defense blocking payloads exceeding memory ceilings.
- **Scenario 3:** Semantic diffing generating human-readable audit trails.
- **Scenario 4:** Scope-based visibility filtering (`PUBLIC` vs `INTERNAL`).

```bash
git clone https://github.com/realgrando/jsonb-rec.git
cd jsonb-rec
npm install
npm run simulate
```

To run the automated Vitest test suite:

```bash
npm test
```

To verify clean TypeScript compilation:

```bash
npm run typecheck
```

---

## Deep Dive Notes

For a complete analysis of EAV trade-offs, GIN indexing patterns, and JSON-Bomb security mitigations, read:
👉 **[Architecture Deep Dive (`docs/ARCHITECTURE_DEEP_DIVE.md`)](file:///home/gustavo/Documentos/Code/jsonb-rec/docs/ARCHITECTURE_DEEP_DIVE.md)**

---

## License

MIT © [Gustavo Grando](https://github.com/realgrando)
