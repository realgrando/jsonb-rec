/**
 * Drizzle ORM Storage Driver for JSONB Field Metamodel
 */

import { and, asc, eq, isNull } from 'drizzle-orm';
import { slugifyFieldKey } from '../../core/slugify';
import {
  FieldType,
  IFieldDefinition,
  IFieldGroup,
  IFieldSchemaStorageDriver,
} from '../../interfaces';
import { fieldDefinitions, fieldGroups } from './schema';

export class DrizzleFieldSchemaStorage implements IFieldSchemaStorageDriver {
  private readonly db: any;

  constructor(drizzleDbInstance: any) {
    this.db = drizzleDbInstance;
  }

  private getExecutor(tx?: unknown): any {
    return (tx as any) ?? this.db;
  }

  public async findFields(
    scopeId?: string,
    tx?: unknown
  ): Promise<IFieldDefinition[]> {
    const executor = this.getExecutor(tx);
    const conditions = [isNull(fieldDefinitions.deletedAt)];

    if (scopeId) {
      conditions.push(eq(fieldDefinitions.scopeId, scopeId));
    }

    const rows = await executor
      .select()
      .from(fieldDefinitions)
      .where(and(...conditions))
      .orderBy(asc(fieldDefinitions.position));

    return rows.map((r: any) => this.mapField(r));
  }

  public async findFieldByKey(
    key: string,
    scopeId?: string,
    tx?: unknown
  ): Promise<IFieldDefinition | null> {
    const executor = this.getExecutor(tx);
    const conditions = [
      isNull(fieldDefinitions.deletedAt),
      eq(fieldDefinitions.key, key),
    ];

    if (scopeId) {
      conditions.push(eq(fieldDefinitions.scopeId, scopeId));
    }

    const rows = await executor
      .select()
      .from(fieldDefinitions)
      .where(and(...conditions))
      .limit(1);

    return rows.length > 0 ? this.mapField(rows[0]) : null;
  }

  public async findGroups(
    scopeId?: string,
    visibilityScope?: string,
    tx?: unknown
  ): Promise<IFieldGroup[]> {
    const executor = this.getExecutor(tx);
    const groupConditions = [isNull(fieldGroups.deletedAt)];

    if (visibilityScope && visibilityScope !== 'GLOBAL') {
      groupConditions.push(eq(fieldGroups.visibilityScope, visibilityScope));
    }

    const groupsRows = await executor
      .select()
      .from(fieldGroups)
      .where(and(...groupConditions))
      .orderBy(asc(fieldGroups.displayOrder));

    const allFields = await this.findFields(scopeId, tx);

    return groupsRows.map((g: any) => ({
      ...this.mapGroup(g),
      fields: allFields.filter((f) => f.groupId === g.id),
    }));
  }

  public async createField(
    field: Omit<IFieldDefinition, 'id' | 'key' | 'createdAt' | 'updatedAt'>,
    tx?: unknown
  ): Promise<IFieldDefinition> {
    const executor = this.getExecutor(tx);
    const key = slugifyFieldKey(field.name);

    const [created] = await executor
      .insert(fieldDefinitions)
      .values({
        scopeId: field.scopeId,
        groupId: field.groupId,
        name: field.name,
        key,
        fieldType: field.fieldType,
        options: field.options ?? [],
        isRequired: field.isRequired ?? false,
        position: field.position ?? 0,
        renderLocation: field.renderLocation ?? 'MAIN_TAB',
      })
      .returning();

    return this.mapField(created);
  }

  public async updateField(
    id: string,
    patch: Partial<IFieldDefinition>,
    tx?: unknown
  ): Promise<IFieldDefinition> {
    const executor = this.getExecutor(tx);
    const updateData: any = {
      ...patch,
      updatedAt: new Date(),
    };

    if (patch.name) {
      updateData.key = slugifyFieldKey(patch.name);
    }

    const [updated] = await executor
      .update(fieldDefinitions)
      .set(updateData)
      .where(and(eq(fieldDefinitions.id, id), isNull(fieldDefinitions.deletedAt)))
      .returning();

    if (!updated) {
      throw new Error(`Field definition <${id}> not found.`);
    }

    return this.mapField(updated);
  }

  public async deleteField(id: string, tx?: unknown): Promise<boolean> {
    const executor = this.getExecutor(tx);
    const [deleted] = await executor
      .update(fieldDefinitions)
      .set({ deletedAt: new Date() })
      .where(eq(fieldDefinitions.id, id))
      .returning();

    return Boolean(deleted);
  }

  public async createGroup(
    group: Omit<IFieldGroup, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: unknown
  ): Promise<IFieldGroup> {
    const executor = this.getExecutor(tx);
    const [created] = await executor
      .insert(fieldGroups)
      .values({
        name: group.name,
        visibilityScope: group.visibilityScope ?? 'GLOBAL',
        displayOrder: group.displayOrder ?? 0,
      })
      .returning();

    return this.mapGroup(created);
  }

  public async updateGroup(
    id: string,
    patch: Partial<IFieldGroup>,
    tx?: unknown
  ): Promise<IFieldGroup> {
    const executor = this.getExecutor(tx);
    const [updated] = await executor
      .update(fieldGroups)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(fieldGroups.id, id), isNull(fieldGroups.deletedAt)))
      .returning();

    if (!updated) {
      throw new Error(`Field group <${id}> not found.`);
    }

    return this.mapGroup(updated);
  }

  public async deleteGroup(id: string, tx?: unknown): Promise<boolean> {
    const executor = this.getExecutor(tx);
    const [deleted] = await executor
      .update(fieldGroups)
      .set({ deletedAt: new Date() })
      .where(eq(fieldGroups.id, id))
      .returning();

    return Boolean(deleted);
  }

  private mapField(row: any): IFieldDefinition {
    return {
      id: row.id,
      scopeId: row.scopeId,
      groupId: row.groupId,
      name: row.name,
      key: row.key,
      fieldType: row.fieldType as FieldType,
      options: row.options,
      isRequired: Boolean(row.isRequired),
      position: Number(row.position),
      renderLocation: row.renderLocation,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
    };
  }

  private mapGroup(row: any): IFieldGroup {
    return {
      id: row.id,
      name: row.name,
      visibilityScope: row.visibilityScope,
      displayOrder: Number(row.displayOrder),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
    };
  }
}
