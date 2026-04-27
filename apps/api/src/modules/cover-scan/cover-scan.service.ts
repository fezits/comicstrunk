// usado nas Tasks 4-6: import { prisma } from '../../shared/lib/prisma';
import type {
  CoverScanSearchInput,
  CoverScanSearchResponse,
} from '@comicstrunk/contracts';

export async function searchByText(
  _userId: string,
  _input: CoverScanSearchInput,
): Promise<CoverScanSearchResponse> {
  // Implementacao completa vira nas Tasks 4 e 5
  return { candidates: [], scanLogId: '' };
}
