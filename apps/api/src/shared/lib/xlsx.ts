import ExcelJS from 'exceljs';

// ============================================================================
// Field Mappings — Portuguese display names ↔ internal field names
// ============================================================================

/** Catalog field mapping: friendly pt-BR name → internal field */
export const CATALOG_FIELD_MAP: Record<string, string> = {
  'Título': 'title',
  'Autor': 'author',
  'Editora': 'publisher',
  'Selo': 'imprint',
  'Série': 'seriesTitle',
  'Volume': 'volumeNumber',
  'Edição': 'editionNumber',
  'ISBN': 'isbn',
  'Código de Barras': 'barcode',
  'Preço de Capa (R$)': 'coverPrice',
  'Ano de Publicação': 'publishYear',
  'Mês de Publicação': 'publishMonth',
  'Páginas': 'pageCount',
  'Descrição': 'description',
  'Categorias': 'categories',
  'Tags': 'tags',
  'Personagens': 'characters',
  'URL da Capa': 'coverUrl',
};

/** Collection field mapping: friendly pt-BR name → internal field */
export const COLLECTION_FIELD_MAP: Record<string, string> = {
  'Título do Gibi': 'catalogEntryTitle',
  'Quantidade': 'quantity',
  'Preço Pago (R$)': 'pricePaid',
  'Estado': 'condition',
  'Observações': 'notes',
  'Já Leu?': 'isRead',
  'À Venda?': 'isForSale',
  'Preço de Venda (R$)': 'salePrice',
};

/** Condition translations */
const CONDITION_PT_TO_EN: Record<string, string> = {
  'Novo': 'NEW',
  'Muito Bom': 'VERY_GOOD',
  'Bom': 'GOOD',
  'Regular': 'FAIR',
  'Ruim': 'POOR',
};

const CONDITION_EN_TO_PT: Record<string, string> = {
  'NEW': 'Novo',
  'VERY_GOOD': 'Muito Bom',
  'GOOD': 'Bom',
  'FAIR': 'Regular',
  'POOR': 'Ruim',
};

/** Boolean translations */
function boolToPt(val: boolean | null | undefined): string {
  if (val === true) return 'Sim';
  if (val === false) return 'Não';
  return '';
}

function ptToBool(val: string | null | undefined): boolean {
  if (!val) return false;
  const v = val.toString().trim().toLowerCase();
  return v === 'sim' || v === 'true' || v === 's' || v === '1';
}

// ============================================================================
// Reverse map: internal → pt-BR
// ============================================================================

function reverseMap(map: Record<string, string>): Record<string, string> {
  const reversed: Record<string, string> = {};
  for (const [pt, en] of Object.entries(map)) reversed[en] = pt;
  return reversed;
}

export const CATALOG_REVERSE = reverseMap(CATALOG_FIELD_MAP);
export const COLLECTION_REVERSE = reverseMap(COLLECTION_FIELD_MAP);

// ============================================================================
// Theme colors
// ============================================================================

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF7C3AED' }, // primary purple
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

const EXAMPLE_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF3F4F6' }, // light gray
};

const EXAMPLE_FONT: Partial<ExcelJS.Font> = {
  italic: true,
  color: { argb: 'FF6B7280' },
  size: 10,
};

// ============================================================================
// Parse XLSX → internal field names
// ============================================================================

export async function parseXLSX(
  buffer: Buffer,
  fieldMap: Record<string, string>,
): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet = workbook.getWorksheet('Dados') || workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) return [];

  // Read headers from row 1
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = cell.text?.trim() || '';
  });

  // Map pt-BR headers to internal field names
  const colMap: Record<number, string> = {};
  for (let col = 1; col < headers.length + 1; col++) {
    const ptName = headers[col];
    if (ptName && fieldMap[ptName]) {
      colMap[col] = fieldMap[ptName];
    } else if (ptName) {
      // Try case-insensitive match
      const match = Object.entries(fieldMap).find(
        ([k]) => k.toLowerCase() === ptName.toLowerCase(),
      );
      if (match) colMap[col] = match[1];
    }
  }

  // Parse data rows (skip example rows that start with italic or have the note)
  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return; // skip header

    // Skip example rows (check if first cell font is italic)
    const firstCell = row.getCell(1);
    if (firstCell.font?.italic) return;

    // Skip rows where first cell contains "Apague" instruction
    const firstValue = firstCell.text?.trim() || '';
    if (!firstValue) return;
    if (firstValue.toLowerCase().includes('apague')) return;

    const obj: Record<string, string> = {};
    let hasData = false;

    for (const [colStr, fieldName] of Object.entries(colMap)) {
      const col = parseInt(colStr);
      const cell = row.getCell(col);
      let value = cell.text?.trim() || '';

      // Translate conditions
      if (fieldName === 'condition' && CONDITION_PT_TO_EN[value]) {
        value = CONDITION_PT_TO_EN[value];
      }

      // Translate booleans
      if (fieldName === 'isRead' || fieldName === 'isForSale') {
        value = ptToBool(value) ? 'true' : 'false';
      }

      // Parse currency (remove R$, replace comma with dot)
      if (fieldName === 'pricePaid' || fieldName === 'salePrice' || fieldName === 'coverPrice') {
        value = value.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.').trim();
      }

      if (value) hasData = true;
      obj[fieldName] = value;
    }

    if (hasData) rows.push(obj);
  });

  return rows;
}

// ============================================================================
// Generate XLSX from data
// ============================================================================

interface GenerateOptions {
  sheetName?: string;
  includeExamples?: boolean;
  examples?: Record<string, string | number | boolean | null>[];
  instructionsText?: string;
  dropdowns?: Record<string, string[]>; // column name → dropdown values
}

export async function generateXLSX(
  data: Record<string, unknown>[],
  fieldMap: Record<string, string>,
  reverseFieldMap: Record<string, string>,
  options: GenerateOptions = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Comics Trunk';
  workbook.created = new Date();

  const sheetName = options.sheetName || 'Dados';
  const sheet = workbook.addWorksheet(sheetName);

  // Determine columns from the reverse map (internal → pt-BR)
  const internalFields = Object.keys(reverseFieldMap);
  const ptHeaders = internalFields.map(f => reverseFieldMap[f]);

  // Set columns
  sheet.columns = internalFields.map((field, i) => ({
    header: ptHeaders[i],
    key: field,
    width: Math.max(ptHeaders[i].length + 4, 15),
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF5B21B6' } },
    };
  });
  headerRow.height = 22;

  // Add example rows if requested
  if (options.includeExamples && options.examples?.length) {
    for (const example of options.examples) {
      const row = sheet.addRow(example);
      row.eachCell((cell) => {
        cell.fill = EXAMPLE_FILL;
        cell.font = EXAMPLE_FONT;
      });
    }
  }

  // Add data rows
  for (const item of data) {
    const rowData: Record<string, unknown> = {};
    for (const field of internalFields) {
      let value = item[field];

      // Translate conditions
      if (field === 'condition' && typeof value === 'string' && CONDITION_EN_TO_PT[value]) {
        value = CONDITION_EN_TO_PT[value];
      }

      // Translate booleans
      if (field === 'isRead' || field === 'isForSale') {
        value = boolToPt(value as boolean);
      }

      // Format currency
      if ((field === 'pricePaid' || field === 'salePrice' || field === 'coverPrice') && value != null) {
        value = Number(value);
      }

      rowData[field] = value ?? '';
    }
    sheet.addRow(rowData);
  }

  // Add dropdowns
  if (options.dropdowns) {
    const dataStartRow = options.includeExamples ? 2 + (options.examples?.length || 0) : 2;
    const lastRow = Math.max(sheet.rowCount + 100, dataStartRow + 100); // extend for future rows

    for (const [ptFieldName, values] of Object.entries(options.dropdowns)) {
      const colIndex = ptHeaders.indexOf(ptFieldName) + 1;
      if (colIndex <= 0) continue;

      for (let row = dataStartRow; row <= lastRow; row++) {
        sheet.getCell(row, colIndex).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${values.join(',')}"`],
        };
      }
    }
  }

  // Add instructions sheet
  if (options.instructionsText) {
    const instrSheet = workbook.addWorksheet('Instruções');
    instrSheet.getColumn(1).width = 25;
    instrSheet.getColumn(2).width = 60;

    instrSheet.getCell('A1').value = 'Comics Trunk — Instruções de Importação';
    instrSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF7C3AED' } };
    instrSheet.mergeCells('A1:B1');

    instrSheet.getCell('A3').value = 'Campo';
    instrSheet.getCell('B3').value = 'Descrição';
    instrSheet.getCell('A3').font = { bold: true };
    instrSheet.getCell('B3').font = { bold: true };

    const lines = options.instructionsText.split('\n').filter(l => l.trim());
    let row = 4;
    for (const line of lines) {
      const [field, ...descParts] = line.split(':');
      if (descParts.length > 0) {
        instrSheet.getCell(row, 1).value = field.trim();
        instrSheet.getCell(row, 1).font = { bold: true };
        instrSheet.getCell(row, 2).value = descParts.join(':').trim();
      } else {
        instrSheet.getCell(row, 1).value = field.trim();
      }
      row++;
    }

    instrSheet.getCell(row + 1, 1).value = '⚠ Apague as linhas de exemplo antes de importar!';
    instrSheet.getCell(row + 1, 1).font = { bold: true, color: { argb: 'FFDC2626' } };
    instrSheet.mergeCells(row + 1, 1, row + 1, 2);
  }

  // Auto-fit columns (min 12, max 40)
  sheet.columns.forEach(col => {
    if (col.width && col.width < 12) col.width = 12;
    if (col.width && col.width > 40) col.width = 40;
  });

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ============================================================================
// Template generators
// ============================================================================

export async function generateCatalogTemplate(): Promise<Buffer> {
  return generateXLSX([], CATALOG_FIELD_MAP, CATALOG_REVERSE, {
    sheetName: 'Dados',
    includeExamples: true,
    examples: [
      {
        title: 'Batman: Year One',
        author: 'Frank Miller',
        publisher: 'DC Comics',
        seriesTitle: 'Batman',
        editionNumber: 1,
        isbn: '9781401207526',
        coverPrice: 89.9,
        publishYear: 1987,
        pageCount: 144,
        categories: 'Super-heróis',
        characters: 'Batman; Gordon',
        description: 'A origem definitiva do Batman',
      },
      {
        title: 'Dragon Ball Vol. 1',
        author: 'Akira Toriyama',
        publisher: 'Panini',
        seriesTitle: 'Dragon Ball',
        volumeNumber: 1,
        editionNumber: 1,
        isbn: '9788545702160',
        coverPrice: 29.9,
        publishYear: 1984,
        pageCount: 192,
        categories: 'Mangás',
        characters: 'Goku; Bulma',
        description: 'O início da jornada de Goku',
      },
    ],
    dropdowns: {},
    instructionsText: `Título: Nome completo do gibi (obrigatório)
Autor: Roteirista ou autor principal
Editora: Editora que publicou (ex: Panini, DC Comics, Marvel)
Selo: Selo editorial, se houver (ex: Panini Manga, Vertigo)
Série: Nome da série a qual pertence (será criada se não existir)
Volume: Número do volume (apenas número)
Edição: Número da edição (apenas número)
ISBN: Código ISBN-10 ou ISBN-13
Código de Barras: Código de barras do produto
Preço de Capa (R$): Preço de capa em reais (use vírgula: 29,90)
Ano de Publicação: Ano (ex: 2024)
Mês de Publicação: Mês (1 a 12)
Páginas: Número de páginas
Descrição: Descrição ou sinopse
Categorias: Separar múltiplas com ponto-e-vírgula (;)
Tags: Separar múltiplas com ponto-e-vírgula (;)
Personagens: Separar múltiplos com ponto-e-vírgula (;)
URL da Capa: URL direta para imagem de capa`,
  });
}

export async function generateCollectionTemplate(): Promise<Buffer> {
  return generateXLSX([], COLLECTION_FIELD_MAP, COLLECTION_REVERSE, {
    sheetName: 'Dados',
    includeExamples: true,
    examples: [
      {
        catalogEntryTitle: 'Batman: Year One',
        quantity: 1,
        pricePaid: 75,
        condition: 'Muito Bom',
        isRead: 'Sim',
        isForSale: 'Não',
        salePrice: '',
        notes: '',
      },
      {
        catalogEntryTitle: 'Dragon Ball Vol. 1',
        quantity: 2,
        pricePaid: 25,
        condition: 'Novo',
        isRead: 'Sim',
        isForSale: 'Sim',
        salePrice: 28,
        notes: 'Edição com pôster',
      },
    ],
    dropdowns: {
      'Estado': ['Novo', 'Muito Bom', 'Bom', 'Regular', 'Ruim'],
      'Já Leu?': ['Sim', 'Não'],
      'À Venda?': ['Sim', 'Não'],
    },
    instructionsText: `Título do Gibi: Nome exato do gibi como está no catálogo (obrigatório)
Quantidade: Quantas cópias você possui (padrão: 1)
Preço Pago (R$): Quanto pagou em reais (use vírgula: 25,00)
Estado: Estado de conservação — use o dropdown (Novo, Muito Bom, Bom, Regular, Ruim)
Observações: Anotações pessoais sobre o gibi
Já Leu?: Se já leu este gibi (Sim ou Não)
À Venda?: Se deseja colocar à venda no marketplace (Sim ou Não)
Preço de Venda (R$): Preço de venda no marketplace (use vírgula: 28,00)`,
  });
}
