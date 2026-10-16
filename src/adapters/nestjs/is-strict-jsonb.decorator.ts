/**
 * NestJS / Class-Validator Decorator for Strict JSONB Safety
 * Guards endpoints against payload memory exhaustion and arbitrary object injection.
 */

import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { RuntimeDataValidator } from '../../core/validator';

@ValidatorConstraint({ name: 'IsStrictJsonbData', async: false })
export class IsStrictJsonbDataConstraint implements ValidatorConstraintInterface {
  private errorMessage = 'JSONB payload has invalid format or exceeds safety limits.';

  validate(value: any) {
    if (value === undefined || value === null) return true;

    if (typeof value !== 'object' || Array.isArray(value)) {
      this.errorMessage = 'Payload must be a valid JSON object.';
      return false;
    }

    const safetySchema = RuntimeDataValidator.createSafetySchema();
    const result = safetySchema.safeParse(value);

    if (!result.success) {
      this.errorMessage = `Invalid JSONB: ${result.error.issues
        .map((e) => `${e.path.join('.') || 'root'}: ${e.message}`)
        .join(', ')}`;
      return false;
    }

    return true;
  }

  defaultMessage() {
    return this.errorMessage;
  }
}

export function IsStrictJsonbData(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrictJsonbDataConstraint,
    });
  };
}
