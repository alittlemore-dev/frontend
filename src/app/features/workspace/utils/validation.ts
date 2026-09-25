import { AbstractControl, FormControl, ValidationErrors, Validators } from '@angular/forms';
import { I18nService } from '../../../core/i18n/i18n.service';

export const VALIDATION_LIMITS = {
  shortText: 255,
  url: 2048,
  email: 254,
  summary: 1200,
  experienceSummary: 800,
  projectDescription: 600,
  educationDescription: 500,
  additionalDescription: 500,
  highlight: 300,
  visibleText: 50000,
  skillGroups: 12,
  skillsPerGroup: 30,
  skillsTotal: 200,
  experience: 20,
  projectsPerExperience: 15,
  projectsTotal: 100,
  experienceHighlights: 15,
  projectHighlights: 12,
  experienceTechnologies: 30,
  projectTechnologies: 25,
  education: 8,
  languages: 9,
  certifications: 15,
  additionalSections: 6,
  additionalItemsPerSection: 12,
  additionalItemsTotal: 30,
} as const;

export function trimRequired(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { required: true } : null;
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

export function resumePhoneValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (value === '') return null;
  if (!/^\+?[0-9 ()/.-]+(?:\s*(?:ext\.?|x)\s*\d{1,6})?$/i.test(value)) {
    return { phone: true };
  }
  const digitCount = [...value].filter((character) => /\d/.test(character)).length;
  return digitCount >= 7 && digitCount <= 20 ? null : { phone: true };
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
  if (errors['url'] !== undefined) return i18n.translate('validation.url');
  if (errors['email'] !== undefined) return i18n.translate('validation.email');
  if (errors['phone'] !== undefined) return i18n.translate('resumeWorkspace.validation.phone');
  return null;
}

export function isRequiredShortText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== '' && trimmed.length <= VALIDATION_LIMITS.shortText;
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
