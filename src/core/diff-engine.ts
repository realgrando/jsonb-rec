/**
 * Semantic Diff Engine — JSONB Mutation Auditor
 * 
 * Computes deep differences between old and new JSONB states and resolves
 * human-readable descriptions mapped against dynamic field definitions.
 */

import { FieldChangeDiff, IFieldDefinition } from '../interfaces';

export class SemanticDiffEngine {
  /**
   * Compares two JSONB data records and generates a list of semantic changes.
   */
  public static compute(
    oldData: Record<string, unknown> = {},
    newData: Record<string, unknown> = {},
    definitions: IFieldDefinition[] = []
  ): FieldChangeDiff[] {
    const diffs: FieldChangeDiff[] = [];
    const definitionMap = new Map<string, IFieldDefinition>(
      definitions.map((def) => [def.key, def])
    );

    const allKeys = Array.from(
      new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})])
    );

    for (const key of allKeys) {
      const oldVal = oldData ? oldData[key] : undefined;
      const newVal = newData ? newData[key] : undefined;

      // Check if value changed
      if (this.isEqual(oldVal, newVal)) {
        continue;
      }

      const definition = definitionMap.get(key);
      const label = definition ? definition.name : key;

      let description: string;

      if (oldVal === undefined || oldVal === null || oldVal === '') {
        description = `Field "${label}" set to "${this.formatValue(newVal)}".`;
      } else if (newVal === undefined || newVal === null || newVal === '') {
        description = `Field "${label}" cleared (was "${this.formatValue(oldVal)}").`;
      } else {
        description = `Field "${label}" changed from "${this.formatValue(
          oldVal
        )}" to "${this.formatValue(newVal)}".`;
      }

      diffs.push({
        key,
        label,
        oldValue: oldVal,
        newValue: newVal,
        description,
      });
    }

    return diffs;
  }

  private static isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null && b === undefined) return true;
    if (a === undefined && b === null) return true;
    if (typeof a === 'object' && typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return String(a ?? '') === String(b ?? '');
  }

  private static formatValue(val: unknown): string {
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }
}
