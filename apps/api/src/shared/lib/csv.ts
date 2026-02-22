import Papa from 'papaparse';

export function parseCSV<T>(buffer: Buffer): { data: T[]; errors: Papa.ParseError[] } {
  const csvString = buffer.toString('utf-8');

  const result = Papa.parse<T>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  return {
    data: result.data,
    errors: result.errors,
  };
}

export function generateCSV(rows: Record<string, unknown>[]): string {
  return Papa.unparse(rows);
}
