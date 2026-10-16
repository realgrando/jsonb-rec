/**
 * In-Memory Field Schema Storage Adapter
 * Zero-dependency storage driver for local testing, CI/CD, and fast simulations.
 */

import { slugifyFieldKey } from '../../core/slugify';
import {
  IFieldDefinition,
  IFieldGroup,
  IFieldSchemaStorageDriver,
} from '../../interfaces';

export class InMemoryFieldSchemaStorage implements IFieldSchemaStorageDriver {
  private readonly fields = new Map<string, IFieldDefinition>();
  private readonly groups = new Map<string, IFieldGroup>();

  public async findFields(scopeId?: string): Promise<IFieldDefinition[]> {
    return Array.from(this.fields.values())
      .filter((f) => {
        if (f.deletedAt) return false;
        if (scopeId && f.scopeId && f.scopeId !== scopeId) return false;
        return true;
      })
      .sort((a, b) => a.position - b.position);
  }

  public async findFieldByKey(
    key: string,
    scopeId?: string
  ): Promise<IFieldDefinition | null> {
    const field = Array.from(this.fields.values()).find((f) => {
      if (f.deletedAt) return false;
      if (f.key !== key) return false;
      if (scopeId && f.scopeId && f.scopeId !== scopeId) return false;
      return true;
    });

    return field ?? null;
  }

  public async findGroups(
    scopeId?: string,
    visibilityScope?: string
  ): Promise<IFieldGroup[]> {
    const allFields = await this.findFields(scopeId);

    return Array.from(this.groups.values())
      .filter((g) => {
        if (g.deletedAt) return false;
        if (
          visibilityScope &&
          g.visibilityScope !== 'GLOBAL' &&
          g.visibilityScope !== visibilityScope
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((g) => ({
        ...g,
        fields: allFields.filter((f) => f.groupId === g.id),
      }));
  }

  public async createField(
    field: Omit<IFieldDefinition, 'id' | 'key' | 'createdAt' | 'updatedAt'>
  ): Promise<IFieldDefinition> {
    const id = this.generateId();
    const key = slugifyFieldKey(field.name);
    const now = new Date();

    const created: IFieldDefinition = {
      ...field,
      id,
      key,
      createdAt: now,
      updatedAt: now,
    };

    this.fields.set(id, created);
    return created;
  }

  public async updateField(
    id: string,
    patch: Partial<IFieldDefinition>
  ): Promise<IFieldDefinition> {
    const existing = this.fields.get(id);
    if (!existing) {
      throw new Error(`Field with ID "${id}" not found.`);
    }

    const updated: IFieldDefinition = {
      ...existing,
      ...patch,
      key: patch.name ? slugifyFieldKey(patch.name) : existing.key,
      updatedAt: new Date(),
    };

    this.fields.set(id, updated);
    return updated;
  }

  public async deleteField(id: string): Promise<boolean> {
    const existing = this.fields.get(id);
    if (!existing) return false;
    existing.deletedAt = new Date();
    this.fields.set(id, existing);
    return true;
  }

  public async createGroup(
    group: Omit<IFieldGroup, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<IFieldGroup> {
    const id = this.generateId();
    const now = new Date();

    const created: IFieldGroup = {
      ...group,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.groups.set(id, created);
    return created;
  }

  public async updateGroup(
    id: string,
    patch: Partial<IFieldGroup>
  ): Promise<IFieldGroup> {
    const existing = this.groups.get(id);
    if (!existing) {
      throw new Error(`Group with ID "${id}" not found.`);
    }

    const updated: IFieldGroup = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };

    this.groups.set(id, updated);
    return updated;
  }

  public async deleteGroup(id: string): Promise<boolean> {
    const existing = this.groups.get(id);
    if (!existing) return false;
    existing.deletedAt = new Date();
    this.groups.set(id, existing);
    return true;
  }

  public clear(): void {
    this.fields.clear();
    this.groups.clear();
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
