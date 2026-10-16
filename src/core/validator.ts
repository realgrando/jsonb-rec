/**
 * Runtime Data Validator — Anti-JSON-Bomb & Dynamic Metamodel Checker
 */

import { z } from 'zod';
import {
  FieldValidationResult,
  IFieldDefinition,
} from '../interfaces';

export class RuntimeDataValidator {
  public static readonly DEFAULT_MAX_PAYLOAD_SIZE = 51200; // 50 KB
  public static readonly DEFAULT_MAX_STRING_LENGTH = 10000;
  public static readonly DEFAULT_MAX_ARRAY_ITEMS = 100;

  /**
   * Validates raw JSONB payload against anti-bomb safety limits.
   */
  public static createSafetySchema(options?: {
    maxSizeBytes?: number;
    maxStringLength?: number;
    maxArrayItems?: number;
  }) {
    const maxSizeBytes = options?.maxSizeBytes ?? this.DEFAULT_MAX_PAYLOAD_SIZE;
    const maxStringLength =
      options?.maxStringLength ?? this.DEFAULT_MAX_STRING_LENGTH;
    const maxArrayItems = options?.maxArrayItems ?? this.DEFAULT_MAX_ARRAY_ITEMS;

    return z
      .record(
        z.string().min(1).max(255),
        z.union([
          z.string().max(maxStringLength),
          z.number(),
          z.boolean(),
          z.null(),
          z.array(z.string().max(maxStringLength)).max(maxArrayItems),
          z.record(z.string(), z.any()),
        ])
      )
      .refine(
        (data) => {
          try {
            return JSON.stringify(data).length <= maxSizeBytes;
          } catch {
            return false;
          }
        },
        {
          message: `JSONB payload exceeds memory security ceiling (${Math.round(
            maxSizeBytes / 1024
          )} KB)`,
        }
      );
  }

  /**
   * Performs deep type checking of payload against dynamic field definitions.
   */
  public static validateAgainstDefinitions(
    payload: unknown,
    definitions: IFieldDefinition[],
    options?: { maxSizeBytes?: number }
  ): FieldValidationResult {
    const errors: Array<{ fieldKey: string; message: string }> = [];

    // 1. Structural Check
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return {
        isValid: false,
        errors: [{ fieldKey: '_root', message: 'Payload must be a valid JSON object' }],
      };
    }

    // 2. Anti-JSON-Bomb Byte Ceiling Check (Fast fail before parsing)
    let rawString = '';
    try {
      rawString = JSON.stringify(payload);
    } catch {
      return {
        isValid: false,
        errors: [{ fieldKey: '_root', message: 'Payload cannot be serialized to JSON' }],
      };
    }

    const maxSizeBytes = options?.maxSizeBytes ?? this.DEFAULT_MAX_PAYLOAD_SIZE;
    if (rawString.length > maxSizeBytes) {
      return {
        isValid: false,
        errors: [
          {
            fieldKey: '_root',
            message: `JSONB payload exceeds memory security ceiling (${Math.round(
              maxSizeBytes / 1024
            )} KB)`,
          },
        ],
      };
    }

    const safetySchema = this.createSafetySchema(options);
    const safetyResult = safetySchema.safeParse(payload);

    if (!safetyResult.success) {
      return {
        isValid: false,
        errors: safetyResult.error.issues.map((i) => ({
          fieldKey: i.path.join('.') || '_root',
          message: i.message,
        })),
      };
    }

    const record = payload as Record<string, unknown>;

    // 2. Validate against explicit Field Definitions
    for (const field of definitions) {
      const val = record[field.key];

      // Required field validation
      if (field.isRequired) {
        if (val === undefined || val === null || val === '') {
          errors.push({
            fieldKey: field.key,
            message: `Field "${field.name}" is required.`,
          });
          continue;
        }
      }

      // If value is omitted and not required, skip type checking
      if (val === undefined || val === null || val === '') {
        continue;
      }

      // Type-specific runtime verification
      switch (field.fieldType) {
        case 'NUMBER':
          if (typeof val !== 'number' || isNaN(val)) {
            errors.push({
              fieldKey: field.key,
              message: `Field "${field.name}" must be a valid number.`,
            });
          }
          break;

        case 'BOOLEAN':
          if (typeof val !== 'boolean') {
            errors.push({
              fieldKey: field.key,
              message: `Field "${field.name}" must be a boolean.`,
            });
          }
          break;

        case 'DATE':
          if (typeof val !== 'string' || isNaN(Date.parse(val))) {
            errors.push({
              fieldKey: field.key,
              message: `Field "${field.name}" must be a valid ISO date string.`,
            });
          }
          break;

        case 'SELECT':
          if (field.options && field.options.length > 0) {
            if (!field.options.includes(String(val))) {
              errors.push({
                fieldKey: field.key,
                message: `Value "${val}" is not permitted for field "${
                  field.name
                }". Allowed options: [${field.options.join(', ')}].`,
              });
            }
          }
          break;

        case 'ARRAY':
          if (!Array.isArray(val)) {
            errors.push({
              fieldKey: field.key,
              message: `Field "${field.name}" must be an array.`,
            });
          }
          break;

        case 'TEXT':
        default:
          if (typeof val !== 'string') {
            errors.push({
              fieldKey: field.key,
              message: `Field "${field.name}" must be a string.`,
            });
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
