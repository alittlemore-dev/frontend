import { ActivatedRoute, ParamMap, Params, Router } from '@angular/router';

export interface QueryReadResult<T> {
  value: T;
  valid: boolean;
}

export function readOptionalStringQuery(
  params: ParamMap,
  key: string,
): QueryReadResult<string | null> {
  const scalar = readScalarQuery(params, key);
  if (!scalar.valid || scalar.value === null) return scalar;
  const value = scalar.value.trim();
  return { value: value === '' ? null : value, valid: true };
}

export function readBooleanQuery(
  params: ParamMap,
  key: string,
  fallback: boolean,
): QueryReadResult<boolean> {
  const scalar = readScalarQuery(params, key);
  if (!scalar.valid) return { value: fallback, valid: false };
  if (scalar.value === null) return { value: fallback, valid: true };
  if (scalar.value === 'true') return { value: true, valid: true };
  if (scalar.value === 'false') return { value: false, valid: true };
  return { value: fallback, valid: false };
}

export function readOptionalBooleanQuery(
  params: ParamMap,
  key: string,
): QueryReadResult<boolean | null> {
  const scalar = readScalarQuery(params, key);
  if (!scalar.valid) return { value: null, valid: false };
  if (scalar.value === null) return { value: null, valid: true };
  if (scalar.value === 'true') return { value: true, valid: true };
  if (scalar.value === 'false') return { value: false, valid: true };
  return { value: null, valid: false };
}

export function readPositiveIntegerQuery(
  params: ParamMap,
  key: string,
  fallback: number,
): QueryReadResult<number> {
  const scalar = readScalarQuery(params, key);
  if (!scalar.valid) return { value: fallback, valid: false };
  if (scalar.value === null) return { value: fallback, valid: true };
  if (!/^\d+$/.test(scalar.value)) return { value: fallback, valid: false };
  const value = Number(scalar.value);
  return Number.isSafeInteger(value) && value > 0
    ? { value, valid: true }
    : { value: fallback, valid: false };
}

export function readIsoDateQuery(params: ParamMap, key: string): QueryReadResult<string | null> {
  const scalar = readScalarQuery(params, key);
  if (!scalar.valid || scalar.value === null) return scalar;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scalar.value)) return { value: null, valid: false };
  const date = new Date(`${scalar.value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === scalar.value
    ? { value: scalar.value, valid: true }
    : { value: null, valid: false };
}

export function readFiniteQuery<T extends string>(
  params: ParamMap,
  key: string,
  values: readonly T[],
  fallback: T,
): QueryReadResult<T> {
  const scalar = readScalarQuery(params, key);
  if (!scalar.valid) return { value: fallback, valid: false };
  if (scalar.value === null) return { value: fallback, valid: true };
  return values.includes(scalar.value as T)
    ? { value: scalar.value as T, valid: true }
    : { value: fallback, valid: false };
}

export function canonicalQueryMatches(
  params: ParamMap,
  ownedKeys: readonly string[],
  canonical: Readonly<Record<string, string | null>>,
): boolean {
  return ownedKeys.every((key) => {
    const actual = params.getAll(key);
    const expected = canonical[key] ?? null;
    if (expected === null) return actual.length === 0;
    return actual.length === 1 && actual[0] === expected;
  });
}

export function replaceAdminQueryParams(
  router: Router,
  route: ActivatedRoute,
  queryParams: Params,
): Promise<boolean> {
  return router.navigate([], {
    relativeTo: route,
    queryParams,
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}

export function queryString(value: string | null): string | null {
  return value === null || value.trim() === '' ? null : value.trim();
}

export function queryNumber(value: number, omittedValue: number): string | null {
  return value === omittedValue ? null : String(value);
}

export function queryFinite<T extends string>(value: T, omittedValue: T): string | null {
  return value === omittedValue ? null : value;
}

function readScalarQuery(params: ParamMap, key: string): QueryReadResult<string | null> {
  const values = params.getAll(key);
  if (values.length === 0) return { value: null, valid: true };
  if (values.length !== 1) return { value: null, valid: false };
  return { value: values[0], valid: true };
}
