/**
 * JSONB-REC — Domain Contracts & Port Interfaces
 * Hexagonal Architecture / Ports & Adapters
 */

export type FieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'SELECT'
  | 'BOOLEAN'
  | 'ARRAY';

export type FieldRenderLocation = 'SIDEBAR' | 'MAIN_TAB' | (string & {});

export interface IFieldDefinition {
  id: string;
  scopeId?: string | null; // e.g. tenantId, boardId, categoryId
  groupId?: string | null;
  name: string;
  key: string;
  fieldType: FieldType;
  options?: string[] | null;
  isRequired: boolean;
  position: number;
  renderLocation?: FieldRenderLocation;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface IFieldGroup {
  id: string;
  name: string;
  visibilityScope: string; // e.g. 'GLOBAL', 'INTERNAL', 'PUBLIC'
  displayOrder: number;
  fields?: IFieldDefinition[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface FieldValidationError {
  fieldKey: string;
  message: string;
}

export interface FieldValidationResult {
  isValid: boolean;
  errors: FieldValidationError[];
}

export interface FieldChangeDiff {
  key: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  description: string;
}

export interface IFieldSchemaStorageDriver {
  findFields(scopeId?: string, tx?: unknown): Promise<IFieldDefinition[]>;
  findFieldByKey(
    key: string,
    scopeId?: string,
    tx?: unknown
  ): Promise<IFieldDefinition | null>;
  findGroups(
    scopeId?: string,
    visibilityScope?: string,
    tx?: unknown
  ): Promise<IFieldGroup[]>;

  createField(
    field: Omit<IFieldDefinition, 'id' | 'key' | 'createdAt' | 'updatedAt'>,
    tx?: unknown
  ): Promise<IFieldDefinition>;

  updateField(
    id: string,
    patch: Partial<IFieldDefinition>,
    tx?: unknown
  ): Promise<IFieldDefinition>;

  deleteField(id: string, tx?: unknown): Promise<boolean>;

  createGroup(
    group: Omit<IFieldGroup, 'id' | 'createdAt' | 'updatedAt'>,
    tx?: unknown
  ): Promise<IFieldGroup>;

  updateGroup(
    id: string,
    patch: Partial<IFieldGroup>,
    tx?: unknown
  ): Promise<IFieldGroup>;

  deleteGroup(id: string, tx?: unknown): Promise<boolean>;
}

export interface JsonbRecOptions {
  storageDriver: IFieldSchemaStorageDriver;
  maxPayloadSizeBytes?: number;
  maxStringLength?: number;
  maxArrayLength?: number;
}
