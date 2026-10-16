import { beforeEach, describe, expect, it } from 'vitest';
import {
  InMemoryFieldSchemaStorage,
  JsonbRecEngine,
  RuntimeDataValidator,
  SemanticDiffEngine,
  slugifyFieldKey,
} from '../src';

describe('JSONB-REC (Unit & Integration Tests)', () => {
  let storage: InMemoryFieldSchemaStorage;
  let engine: JsonbRecEngine;

  beforeEach(async () => {
    storage = new InMemoryFieldSchemaStorage();
    engine = new JsonbRecEngine({
      storageDriver: storage,
      maxPayloadSizeBytes: 10240, // 10 KB for test
    });

    const group = await engine.registerGroup({
      name: 'Client Specifications',
      visibilityScope: 'GLOBAL',
      displayOrder: 1,
    });

    await engine.registerField({
      groupId: group.id,
      name: 'Monthly Recurring Revenue',
      fieldType: 'NUMBER',
      isRequired: true,
      position: 1,
    });

    await engine.registerField({
      groupId: group.id,
      name: 'Tier Level',
      fieldType: 'SELECT',
      options: ['SILVER', 'GOLD', 'PLATINUM'],
      isRequired: true,
      position: 2,
    });

    await engine.registerField({
      groupId: group.id,
      name: 'Contract Date',
      fieldType: 'DATE',
      isRequired: false,
      position: 3,
    });
  });

  describe('Deterministic Slugification', () => {
    it('should convert accented and spaced field names into clean snake_case keys', () => {
      expect(slugifyFieldKey('Budget de Marketing & Operações')).toBe(
        'budget_de_marketing_operacoes'
      );
      expect(slugifyFieldKey('   CPF / CNPJ   ')).toBe('cpf_cnpj');
      expect(slugifyFieldKey('Target Go-Live Date!')).toBe('target_go_live_date');
    });
  });

  describe('Runtime Schema Validation', () => {
    it('should validate compliant payload successfully', async () => {
      const valid = {
        monthly_recurring_revenue: 5000,
        tier_level: 'GOLD',
        contract_date: '2026-10-16',
      };

      const result = await engine.validate(valid);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields and type mismatches', async () => {
      const invalid = {
        monthly_recurring_revenue: 'FIVE_THOUSAND', // Wrong type: string instead of number
        tier_level: 'BRONZE', // Invalid select option
      };

      const result = await engine.validate(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);

      const keys = result.errors.map((e) => e.fieldKey);
      expect(keys).toContain('monthly_recurring_revenue');
      expect(keys).toContain('tier_level');
    });

    it('should reject non-object root payloads', async () => {
      const result = await engine.validate(['array', 'not', 'allowed']);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].fieldKey).toBe('_root');
    });

    it('should trigger anti-JSON-bomb defense on oversized payloads', async () => {
      const bombPayload = {
        monthly_recurring_revenue: 1000,
        tier_level: 'SILVER',
        malicious_overflow: 'x'.repeat(15000), // 15 KB (Limit is 10 KB)
      };

      const result = await engine.validate(bombPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('memory security ceiling');
    });
  });

  describe('Semantic Diffing Engine', () => {
    it('should generate human-readable mutation descriptions mapped to field names', async () => {
      const oldData = {
        monthly_recurring_revenue: 5000,
        tier_level: 'SILVER',
      };

      const newData = {
        monthly_recurring_revenue: 8500, // Modified
        tier_level: 'PLATINUM', // Modified
        contract_date: '2026-11-01', // Added
      };

      const diffs = await engine.computeDiff(oldData, newData);
      expect(diffs).toHaveLength(3);

      const mrrDiff = diffs.find((d) => d.key === 'monthly_recurring_revenue');
      expect(mrrDiff?.description).toBe(
        'Field "Monthly Recurring Revenue" changed from "5000" to "8500".'
      );

      const tierDiff = diffs.find((d) => d.key === 'tier_level');
      expect(tierDiff?.description).toBe(
        'Field "Tier Level" changed from "SILVER" to "PLATINUM".'
      );

      const dateDiff = diffs.find((d) => d.key === 'contract_date');
      expect(dateDiff?.description).toBe(
        'Field "Contract Date" set to "2026-11-01".'
      );
    });

    it('should correctly describe cleared fields', async () => {
      const oldData = { tier_level: 'GOLD' };
      const newData = { tier_level: null };

      const diffs = await engine.computeDiff(oldData, newData);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].description).toBe(
        'Field "Tier Level" cleared (was "GOLD").'
      );
    });
  });

  describe('Visibility Scope Filtering', () => {
    it('should filter groups by visibility scope', async () => {
      await engine.registerGroup({
        name: 'Internal Compliance Notes',
        visibilityScope: 'INTERNAL',
        displayOrder: 2,
      });

      const publicGroups = await engine.getSchema(undefined, 'PUBLIC');
      expect(publicGroups).toHaveLength(1); // Only the GLOBAL one

      const internalGroups = await engine.getSchema(undefined, 'INTERNAL');
      expect(internalGroups).toHaveLength(2); // GLOBAL + INTERNAL
    });
  });
});
