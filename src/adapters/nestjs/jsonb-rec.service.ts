/**
 * NestJS Injectable Service Wrapper for JsonbRecEngine
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { JsonbRecEngine } from '../../core/engine';
import {
  FieldChangeDiff,
  FieldValidationResult,
  IFieldDefinition,
  IFieldGroup,
  IFieldSchemaStorageDriver,
} from '../../interfaces';
import { JSONB_REC_STORAGE_TOKEN } from './tokens';

@Injectable()
export class JsonbRecService {
  private readonly logger = new Logger(JsonbRecService.name);
  private readonly engine: JsonbRecEngine;

  constructor(
    @Inject(JSONB_REC_STORAGE_TOKEN)
    private readonly storage: IFieldSchemaStorageDriver
  ) {
    this.engine = new JsonbRecEngine({
      storageDriver: this.storage,
    });
  }

  public getRawEngine(): JsonbRecEngine {
    return this.engine;
  }

  public async validate(
    payload: unknown,
    scopeId?: string,
    tx?: unknown
  ): Promise<FieldValidationResult> {
    return this.engine.validate(payload, scopeId, tx);
  }

  public async computeDiff(
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
    scopeId?: string,
    tx?: unknown
  ): Promise<FieldChangeDiff[]> {
    return this.engine.computeDiff(oldData, newData, scopeId, tx);
  }

  public async registerField(
    input: Omit<IFieldDefinition, 'id' | 'key' | 'createdAt' | 'updatedAt'>,
    tx?: unknown
  ): Promise<IFieldDefinition> {
    const field = await this.engine.registerField(input, tx);
    this.logger.log(`Registered custom dynamic field: [${field.name}] -> key: "${field.key}"`);
    return field;
  }

  public async registerGroup(
    input: Omit<IFieldGroup, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: unknown
  ): Promise<IFieldGroup> {
    const group = await this.engine.registerGroup(input, tx);
    this.logger.log(`Registered dynamic field group: [${group.name}]`);
    return group;
  }

  public async getSchema(
    scopeId?: string,
    visibilityScope?: string,
    tx?: unknown
  ): Promise<IFieldGroup[]> {
    return this.engine.getSchema(scopeId, visibilityScope, tx);
  }
}
