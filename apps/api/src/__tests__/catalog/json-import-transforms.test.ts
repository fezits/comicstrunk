import { describe, it, expect } from 'vitest';
import {
  extractEditionNumber,
  parsePubDate,
  parsePageCount,
} from '../../modules/catalog/catalog-import.service';

describe('extractEditionNumber', () => {
  it('extracts from "# 14" pattern', () => {
    expect(
      extractEditionNumber(
        'Grandes Herois DC - Os Novos 52 # 14 - Batman - Taticas de Terror',
      ),
    ).toBe(14);
  });

  it('extracts from "#14" without space', () => {
    expect(extractEditionNumber('Batman #14')).toBe(14);
  });

  it('extracts from "# 001" with leading zeros', () => {
    expect(extractEditionNumber('One Piece # 001')).toBe(1);
  });

  it('returns null when no edition marker found', () => {
    expect(extractEditionNumber('Batman: O Cavaleiro das Trevas')).toBeNull();
  });

  it('picks the first # match', () => {
    expect(extractEditionNumber('Title # 5 - Subtitle # 10')).toBe(5);
  });

  it('handles large edition numbers', () => {
    expect(extractEditionNumber('One Piece # 1089')).toBe(1089);
  });
});

describe('parsePubDate', () => {
  it('parses "6/2024" correctly', () => {
    expect(parsePubDate('6/2024')).toEqual({ year: 2024, month: 6 });
  });

  it('parses "12/2023" with two-digit month', () => {
    expect(parsePubDate('12/2023')).toEqual({ year: 2023, month: 12 });
  });

  it('parses "1/2001" single digit month', () => {
    expect(parsePubDate('1/2001')).toEqual({ year: 2001, month: 1 });
  });

  it('returns nulls for invalid format "2024-06"', () => {
    expect(parsePubDate('2024-06')).toEqual({ year: null, month: null });
  });

  it('returns null month for month > 12', () => {
    expect(parsePubDate('13/2024')).toEqual({ year: 2024, month: null });
  });

  it('returns null month for month 0', () => {
    expect(parsePubDate('0/2024')).toEqual({ year: 2024, month: null });
  });

  it('returns nulls for empty string', () => {
    expect(parsePubDate('')).toEqual({ year: null, month: null });
  });

  it('returns nulls for text', () => {
    expect(parsePubDate('June 2024')).toEqual({ year: null, month: null });
  });
});

describe('parsePageCount', () => {
  it('parses valid integer string', () => {
    expect(parsePageCount('232')).toBe(232);
  });

  it('returns null for non-numeric', () => {
    expect(parsePageCount('abc')).toBeNull();
  });

  it('returns null for zero', () => {
    expect(parsePageCount('0')).toBeNull();
  });

  it('returns null for negative', () => {
    expect(parsePageCount('-5')).toBeNull();
  });

  it('handles leading zeros', () => {
    expect(parsePageCount('064')).toBe(64);
  });
});
