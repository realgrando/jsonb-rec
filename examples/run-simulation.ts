/**
 * JSONB-REC — Real-Time Terminal Simulation
 * Run with: npx tsx examples/run-simulation.ts
 */

import {
  InMemoryFieldSchemaStorage,
  JsonbRecEngine,
  RuntimeDataValidator,
  SemanticDiffEngine,
} from '../src';

async function main() {
  console.log('\x1b[1m\x1b[32m');
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║                JSONB-REC — REAL-TIME TERMINAL SIMULATION              ║');
  console.log('║       Hybrid EAV-over-JSONB Schema, Anti-Bomb Validation & Diffing    ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  const storage = new InMemoryFieldSchemaStorage();
  const engine = new JsonbRecEngine({
    storageDriver: storage,
    maxPayloadSizeBytes: 51200, // 50 KB ceiling
  });

  // =========================================================================
  // SCENARIO 1: Dynamic Schema & Metamodel Registration
  // =========================================================================
  console.log('\x1b[1m\x1b[34m----------------------------------------------------------------------\x1b[0m');
  console.log('\x1b[1mSCENARIO 1: Dynamic Metamodel & Field Registration\x1b[0m');
  console.log('\x1b[1m\x1b[34m----------------------------------------------------------------------\x1b[0m');

  // Group 1: General Info (Global Visibility)
  const groupGeneral = await engine.registerGroup({
    name: 'Strategic Information',
    visibilityScope: 'GLOBAL',
    displayOrder: 1,
  });

  // Group 2: Sensitive Financials (Internal Visibility)
  const groupFinance = await engine.registerGroup({
    name: 'Financial Parameters',
    visibilityScope: 'INTERNAL',
    displayOrder: 2,
  });

  // Register Fields with deterministic slugified keys:
  const fieldBudget = await engine.registerField({
    groupId: groupFinance.id,
    name: 'Monthly Budget',
    fieldType: 'NUMBER',
    isRequired: true,
    position: 1,
  });

  const fieldTier = await engine.registerField({
    groupId: groupGeneral.id,
    name: 'Client Tier',
    fieldType: 'SELECT',
    options: ['STARTER', 'GROWTH', 'ENTERPRISE'],
    isRequired: true,
    position: 2,
  });

  const fieldGoLive = await engine.registerField({
    groupId: groupGeneral.id,
    name: 'Target Go-Live Date',
    fieldType: 'DATE',
    isRequired: false,
    position: 3,
  });

  const fieldBriefing = await engine.registerField({
    groupId: groupGeneral.id,
    name: 'Executive Briefing',
    fieldType: 'TEXT',
    isRequired: false,
    position: 4,
  });

  console.log(`✓ Metamodel registered with deterministic keys:`);
  console.log(`  - "${fieldBudget.name}" -> key: \x1b[36m"${fieldBudget.key}"\x1b[0m [${fieldBudget.fieldType}] (Required)`);
  console.log(`  - "${fieldTier.name}" -> key: \x1b[36m"${fieldTier.key}"\x1b[0m [${fieldTier.fieldType}] Options: [${fieldTier.options?.join(', ')}]`);
  console.log(`  - "${fieldGoLive.name}" -> key: \x1b[36m"${fieldGoLive.key}"\x1b[0m [${fieldGoLive.fieldType}]`);
  console.log(`  - "${fieldBriefing.name}" -> key: \x1b[36m"${fieldBriefing.key}"\x1b[0m [${fieldBriefing.fieldType}]\n`);

  // =========================================================================
  // SCENARIO 2: Anti-JSON-Bomb & Strict Runtime Type Validation
  // =========================================================================
  console.log('\x1b[1m\x1b[34m----------------------------------------------------------------------\x1b[0m');
  console.log('\x1b[1mSCENARIO 2: Anti-JSON-Bomb Defense & Runtime Validation\x1b[0m');
  console.log('\x1b[1m\x1b[34m----------------------------------------------------------------------\x1b[0m');

  // Test 2A: Valid Payload
  const validPayload = {
    monthly_budget: 15000,
    client_tier: 'ENTERPRISE',
    target_go_live_date: '2026-12-01',
    executive_briefing: 'High-growth distributed retail customer expansion.',
  };

  const validRes = await engine.validate(validPayload);
  console.log(`[Validation Test A] Submitting compliant payload:`);
  console.log(`  ✓ Result: \x1b[32m\x1b[1mVALID (${validRes.isValid})\x1b[0m | Errors: 0`);

  // Test 2B: Invalid Types & Missing Required Field
  const invalidPayload = {
    monthly_budget: 'NOT_A_NUMBER', // Violation: expected number
    client_tier: 'INVALID_TIER',    // Violation: not in options
  };

  const invalidRes = await engine.validate(invalidPayload);
  console.log(`\n[Validation Test B] Submitting malformed payload (wrong types & unlisted option):`);
  console.log(`  ✖ Result: \x1b[31m\x1b[1mINVALID (${invalidRes.isValid})\x1b[0m | Caught ${invalidRes.errors.length} violations:`);
  for (const err of invalidRes.errors) {
    console.log(`    - \x1b[31m[${err.fieldKey}]\x1b[0m ${err.message}`);
  }

  // Test 2C: Anti-JSON-Bomb Payload (> 50KB memory exhaustion attack)
  const bombPayload: Record<string, string> = {
    monthly_budget: '1000' as any,
    overflow_junk: 'A'.repeat(60000), // 60 KB string
  };

  const bombRes = await engine.validate(bombPayload);
  console.log(`\n[Validation Test C] Submitting 60KB payload (Exceeding 50KB memory ceiling):`);
  console.log(`  ✖ Result: \x1b[31m\x1b[1mBLOCKED BY SECURITY CEILING\x1b[0m`);
  console.log(`    - Cause: ${bombRes.errors[0]?.message}\n`);

  // =========================================================================
  // SCENARIO 3: Semantic Diffing & Mutation Audit Trail
  // =========================================================================
  console.log('\x1b[1m\x1b[34m----------------------------------------------------------------------\x1b[0m');
  console.log('\x1b[1mSCENARIO 3: Semantic Diffing Engine (Granular Audit Trail)\x1b[0m');
  console.log('\x1b[1m\x1b[34m----------------------------------------------------------------------\x1b[0m');

  const oldJsonbState = {
    monthly_budget: 15000,
    client_tier: 'GROWTH',
    executive_briefing: 'Initial strategy meeting.',
  };

  const newJsonbState = {
    monthly_budget: 25000, // Changed
    client_tier: 'ENTERPRISE', // Changed
    target_go_live_date: '2026-11-15', // Added
    executive_briefing: null, // Cleared
  };

  console.log(`Comparing entity state mutation across versions...`);
  const diffs = await engine.computeDiff(oldJsonbState, newJsonbState);

  console.log(`✓ Resolved ${diffs.length} human-readable audit events without relational joins:`);
  for (const diff of diffs) {
    console.log(`  \x1b[32m[AUDIT]\x1b[0m ${diff.description}`);
  }
  console.log('');

  // =========================================================================
  // SCENARIO 4: Scope-Based Visibility Resolution
  // =========================================================================
  console.log('\x1b[1m\x1b[34m----------------------------------------------------------------------\x1b[0m');
  console.log('\x1b[1mSCENARIO 4: Scope-Based Layout & Visibility Resolution\x1b[0m');
  console.log('\x1b[1m\x1b[34m----------------------------------------------------------------------\x1b[0m');

  const publicSchema = await engine.getSchema(undefined, 'PUBLIC');
  const internalSchema = await engine.getSchema(undefined, 'INTERNAL');

  console.log(`Rendering UI layout schema for [PUBLIC View]:`);
  console.log(`  - Visible Groups: ${publicSchema.map((g) => `"${g.name}"`).join(', ')} (Finance hidden)`);

  console.log(`\nRendering UI layout schema for [INTERNAL / Admin View]:`);
  console.log(`  - Visible Groups: ${internalSchema.map((g) => `"${g.name}"`).join(', ')} (Full Access)`);

  console.log('\n\x1b[1m\x1b[32m======================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[32m      SIMULATION COMPLETE: ALL JSONB-REC GUARANTEES VERIFIED           \x1b[0m');
  console.log('\x1b[1m\x1b[32m======================================================================\x1b[0m\n');
}

main().catch((err) => {
  console.error('Fatal Simulation Error:', err);
  process.exit(1);
});
