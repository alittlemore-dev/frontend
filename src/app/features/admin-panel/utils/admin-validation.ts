import { AbstractControl, FormControl, ValidationErrors, Validators } from '@angular/forms';
import { I18nService } from '../../../core/i18n/i18n.service';

export const ADMIN_VALIDATION_LIMITS = {
  accountUsernameMin: 3,
  accountPasswordMin: 8,
  shortText: 255,
  url: 2048,
  email: 254,
  seoDescription: 320,
  articleContent: 100000,
  matrixLongText: 20000,
} as const;

export const ADMIN_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ADMIN_SLUG_PATTERN_ATTRIBUTE = '^[a-z0-9]+(?:-[a-z0-9]+)*$';
export const ADMIN_ACCOUNT_USERNAME_PATTERN = /^[A-Za-z0-9._]+$/;
export const ADMIN_ACCOUNT_USERNAME_PATTERN_ATTRIBUTE = '^[A-Za-z0-9._]+$';

export function trimRequired(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { required: true } : null;
}

export function slugValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (value === '') return null;
  return ADMIN_SLUG_PATTERN.test(value) ? null : { pattern: true };
}

export function accountUsernameValidator(
  control: AbstractControl<string>,
): ValidationErrors | null {
  const value = control.value.trim();
  if (value === '') return null;
  return ADMIN_ACCOUNT_USERNAME_PATTERN.test(value) ? null : { accountUsername: true };
}

export function httpUrlValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (value === '') return null;
  return isHttpUrl(value) ? null : { url: true };
}

export function emailValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (value === '') return null;
  const emailControl = new FormControl(value, { nonNullable: true });
  return Validators.email(emailControl) === null ? null : { email: true };
}

export function controlInvalid(control: AbstractControl<unknown>, submitted: boolean): boolean {
  return control.invalid && (submitted || control.touched);
}

export function validationMessage(
  control: AbstractControl<unknown>,
  i18n: I18nService,
): string | null {
  const errors = control.errors;
  if (errors === null) return null;
  if (errors['required'] !== undefined) return i18n.translate('validation.required');
  if (errors['minlength'] !== undefined) {
    return i18n.translate('validation.minLength', {
      min: minLengthFromError(errors['minlength']),
    });
  }
  if (errors['maxlength'] !== undefined) {
    return i18n.translate('validation.maxLength', {
      max: maxLengthFromError(errors['maxlength']),
    });
  }
  if (errors['accountUsername'] !== undefined) return i18n.translate('validation.accountUsername');
  if (errors['pattern'] !== undefined) return i18n.translate('validation.slug');
  if (errors['url'] !== undefined) return i18n.translate('validation.url');
  if (errors['email'] !== undefined) return i18n.translate('validation.email');
  return null;
}

export function isRequiredShortText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== '' && trimmed.length <= ADMIN_VALIDATION_LIMITS.shortText;
}

export function isSlug(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed !== '' &&
    trimmed.length <= ADMIN_VALIDATION_LIMITS.shortText &&
    ADMIN_SLUG_PATTERN.test(trimmed)
  );
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.trim() !== '';
  } catch {
    return false;
  }
}

function minLengthFromError(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('requiredLength' in error)) {
    return '';
  }
  const requiredLength = error.requiredLength;
  return typeof requiredLength === 'number' ? String(requiredLength) : '';
}

function maxLengthFromError(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('requiredLength' in error)) {
    return '';
  }
  const requiredLength = error.requiredLength;
  return typeof requiredLength === 'number' ? String(requiredLength) : '';
}
