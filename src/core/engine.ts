/**
 * JSONB-REC Engine — Orchestrator for Dynamic Metamodels, Validation & Diffing
 */

import {
  FieldChangeDiff,
  FieldValidationResult,
  IFieldDefinition,
  IFieldGroup,
  IFieldSchemaStorageDriver,
  JsonbRecOptions,
} from '../interfaces';
import { SemanticDiffEngine } from './diff-engine';
import { slugifyFieldKey } from './slugify';
import { RuntimeDataValidator } from './validator';

export class JsonbRecEngine {
  private readonly storage: IFieldSchemaStorageDriver;
  private readonly maxPayloadSizeBytes?: number;

  constructor(options: JsonbRecOptions) {
    this.storage = options.storageDriver;
    this.maxPayloadSizeBytes = options.maxPayloadSizeBytes;
  }

  /**
   * Validates dynamic JSONB data against configured schema definitions.
   */
  public async validate(
    payload: unknown,
    scopeId?: string,
    tx?: unknown
  ): Promise<FieldValidationResult> {
    const definitions = await this.storage.findFields(scopeId, tx);
    return RuntimeDataValidator.validateAgainstDefinitions(payload, definitions, {
      maxSizeBytes: this.maxPayloadSizeBytes,
    });
  }

  /**
   * Compares two JSONB data records and generates descriptive audit change logs.
   */
  public async computeDiff(
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
    scopeId?: string,
    tx?: unknown
  ): Promise<FieldChangeDiff[]> {
    const definitions = await this.storage.findFields(scopeId, tx);
    return SemanticDiffEngine.compute(oldData, newData, definitions);
  }

  /**
   * Registers a new custom field definition with automatic key slugification.
   */
  public async registerField(
    input: Omit<IFieldDefinition, 'id' | 'key' | 'createdAt' | 'updatedAt'>,
    tx?: unknown
  ): Promise<IFieldDefinition> {
    return this.storage.createField(input, tx);
  }

  /**
   * Registers a new custom field group.
   */
  public async registerGroup(
    input: Omit<IFieldGroup, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: unknown
  ): Promise<IFieldGroup> {
    return this.storage.createGroup(input, tx);
  }

  /**
   * Retrieves groups and nested field definitions filtered by scope and visibility.
   */
  public async getSchema(
    scopeId?: string,
    visibilityScope?: string,
    tx?: unknown
  ): Promise<IFieldGroup[]> {
    return this.storage.findGroups(scopeId, visibilityScope, tx);
  }

  /**
   * Helper to slugify a field name into a safe JSONB key.
   */
  public slugifyKey(name: string): string {
    return slugifyFieldKey(name);
  }
}
