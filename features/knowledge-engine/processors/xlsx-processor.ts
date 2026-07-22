import { read, utils } from "xlsx";
import { KNOWLEDGE_ENGINE_CONFIG } from "@/config/knowledge-engine";
import type { DocumentProcessor, ProcessorInput } from "@/features/knowledge-engine/processors/interface";
import { makeSection, normalizeText, warning } from "@/features/knowledge-engine/processors/helpers";

export class XlsxProcessor implements DocumentProcessor {
  readonly id = "xlsx";
  readonly version = "1.0.0";
  readonly supportedMimeTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] as const;
  readonly supportedExtensions = ["xlsx"] as const;

  supports(input: ProcessorInput): boolean {
    return this.supportedMimeTypes.includes(
      input.mimeType as "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) || input.filename.toLowerCase().endsWith(".xlsx");
  }

  async extract(input: ProcessorInput) {
    const workbook = read(Buffer.from(input.bytes), { type: "buffer" });
    const sections: ReturnType<typeof makeSection>[] = [];
    const warnings: ReturnType<typeof warning>[] = [];
    let order = 0;

    const sheetNames = workbook.SheetNames.slice(0, KNOWLEDGE_ENGINE_CONFIG.spreadsheet.maxSheets);
    if (workbook.SheetNames.length > sheetNames.length) {
      warnings.push(warning("XLSX_SHEET_LIMIT", `Only first ${sheetNames.length} sheets were processed.`));
    }

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const rows = utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, { header: 1, raw: false });
      const limitedRows = rows.slice(0, KNOWLEDGE_ENGINE_CONFIG.spreadsheet.maxRowsPerSheet);

      if (rows.length > limitedRows.length) {
        warnings.push(
          warning("XLSX_ROW_LIMIT", `Sheet '${sheetName}' was truncated at ${limitedRows.length} rows.`, { section: sheetName })
        );
      }

      limitedRows.forEach((row, rowIndex) => {
        const limitedCells = row.slice(0, KNOWLEDGE_ENGINE_CONFIG.spreadsheet.maxCellsPerRow);
        const rowText = limitedCells.map((cell, idx) => `${idx + 1}:${String(cell ?? "").trim()}`).join(" | ");
        if (!rowText.trim()) return;
        sections.push(
          makeSection({
            order: order++,
            text: normalizeText(rowText),
            sheetName,
            rowNumber: rowIndex + 1,
            metadata: { sheetName, rowNumber: rowIndex + 1 },
          })
        );
      });
    }

    const fullText = sections.map((section) => section.text).join("\n");

    return {
      processorId: this.id,
      processorVersion: this.version,
      mimeType: input.mimeType,
      filename: input.filename,
      fullText,
      pages: [{ pageNumber: 1, text: fullText, sections }],
      sections,
      warnings,
      metadata: { sheetCount: sheetNames.length },
    };
  }
}
