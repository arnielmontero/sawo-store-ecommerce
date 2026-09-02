import ExcelJS from "exceljs";

// Builds a single-sheet .xlsx workbook and returns it as a Buffer, ready to
// send straight as an HTTP response body — mirrors csv.ts's toCsv() shape
// (headers + rows) so callers barely change when switching formats. Numeric
// cells are passed as real numbers (not formatted strings) so the sheet
// stays sortable/summable in Excel, unlike a CSV export.
export async function toXlsx(headers: string[], rows: (string | number)[][], sheetName = "Sheet1"): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row);
  }

  sheet.columns.forEach((column) => {
    column.width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Reads the first worksheet of an .xlsx file into the same string[][] shape
// parseCsv() returns (header row first, then data rows) — so any code
// written against parseCsv's output (header-name lookup, per-row parsing)
// works unchanged against an xlsx import, only the input source differs.
// Cell values are coerced to strings; a numeric cell (e.g. a price typed as
// a number in Excel) becomes its decimal string form.
export async function fromXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's own index.d.ts declares a conflicting global
  // `interface Buffer extends ArrayBuffer {}` that shadows Node's real
  // Buffer type for its own signatures — a real Node Buffer is exactly
  // what load() expects and accepts at runtime, but no cast can bridge two
  // same-named-but-different global types, so this is the documented
  // workaround for that exceljs typings defect: drop to `any` for this one
  // call only.
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    // ExcelJS's row.values is 1-indexed (index 0 is unused) — start at 1.
    const cellCount = Math.max(row.cellCount, sheet.columnCount);
    for (let col = 1; col <= cellCount; col++) {
      const cell = row.getCell(col);
      values.push(cellToString(cell.value));
    }
    // Trim fully-empty trailing cells so a row doesn't grow past whatever
    // the header row actually defines (columnCount can overshoot on a
    // sparsely-filled sheet).
    while (values.length > 0 && values[values.length - 1] === "") values.pop();
    if (values.length > 0) rows.push(values);
  });

  return rows;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    // Rich text / formula / hyperlink cells — fall back to their plain text
    // representation rather than "[object Object]".
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue);
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }
  return String(value);
}
