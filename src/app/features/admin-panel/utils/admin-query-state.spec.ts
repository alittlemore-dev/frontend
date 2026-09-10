import { convertToParamMap } from '@angular/router';
import {
  canonicalQueryMatches,
  readBooleanQuery,
  readFiniteQuery,
  readIsoDateQuery,
  readOptionalStringQuery,
  readOptionalBooleanQuery,
  readPositiveIntegerQuery,
} from './admin-query-state';

describe('admin query state codecs', () => {
  it('reads trimmed scalar values and rejects duplicate values', () => {
    expect(readOptionalStringQuery(convertToParamMap({ q: '  angular  ' }), 'q')).toEqual({
      value: 'angular',
      valid: true,
    });
    expect(readOptionalStringQuery(convertToParamMap({ q: ['one', 'two'] }), 'q')).toEqual({
      value: null,
      valid: false,
    });
  });

  it('validates booleans, positive integers, ISO dates, and finite values', () => {
    expect(readBooleanQuery(convertToParamMap({ enabled: 'false' }), 'enabled', true)).toEqual({
      value: false,
      valid: true,
    });
    expect(readBooleanQuery(convertToParamMap({ enabled: '0' }), 'enabled', true)).toEqual({
      value: true,
      valid: false,
    });
    expect(readOptionalBooleanQuery(convertToParamMap({ enabled: 'false' }), 'enabled')).toEqual({
      value: false,
      valid: true,
    });
    expect(readPositiveIntegerQuery(convertToParamMap({ page: '3' }), 'page', 1)).toEqual({
      value: 3,
      valid: true,
    });
    expect(readPositiveIntegerQuery(convertToParamMap({ page: '-2' }), 'page', 1)).toEqual({
      value: 1,
      valid: false,
    });
    expect(readIsoDateQuery(convertToParamMap({ date: '2026-02-29' }), 'date')).toEqual({
      value: null,
      valid: false,
    });
    expect(
      readFiniteQuery(
        convertToParamMap({ sort: 'oldest' }),
        'sort',
        ['newest', 'oldest'],
        'newest',
      ),
    ).toEqual({ value: 'oldest', valid: true });
    expect(
      readFiniteQuery(
        convertToParamMap({ sort: 'random' }),
        'sort',
        ['newest', 'oldest'],
        'newest',
      ),
    ).toEqual({ value: 'newest', valid: false });
  });

  it('compares owned query parameters with a canonical serialization', () => {
    const ownedKeys = ['q', 'page', 'sort'] as const;
    const canonical = { q: 'angular', page: null, sort: null };

    expect(
      canonicalQueryMatches(
        convertToParamMap({ q: 'angular', compatibility: 'kept' }),
        ownedKeys,
        canonical,
      ),
    ).toBe(true);
    expect(
      canonicalQueryMatches(convertToParamMap({ q: ['angular', 'angular'] }), ownedKeys, canonical),
    ).toBe(false);
    expect(
      canonicalQueryMatches(convertToParamMap({ q: 'angular', page: '1' }), ownedKeys, canonical),
    ).toBe(false);
  });
});
