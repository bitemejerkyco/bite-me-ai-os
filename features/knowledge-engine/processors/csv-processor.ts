import { parse } from "csv-parse/sync";
import type { DocumentProcessor, ProcessorInput } from "@/features/knowledge-engine/processors/interface";
import { makeSection, normalizeText, warning } from "@/features/knowledge-engine/processors/helpers";

export class CsvProcessor implements DocumentProcessor {
  readonly id = "csv";
  readonly version = "1.0.0";
  readonly supportedMimeTypes = ["text/csv"] as const;
  readonly supportedExtensions = ["csv"] as const;

  supports(input: ProcessorInput): boolean {
    return this.supportedMimeTypes.includes(input.mimeType as "text/csv") || input.filename.toLowerCase().endsWith(".csv");
  }

  async extract(input: ProcessorInput) {
    const raw = normalizeText(Buffer.from(input.bytes).toString("utf8"));
    const warnings = [];
    const sections = [];
    let parsed: string[][] = [];

    try {
      parsed = parse(raw, {
        relax_column_count: true,
        skip_empty_lines: true,
      }) as string[][];
    } catch {
      warnings.push(warning("CSV_PARSE_FAILED", "CSV could not be fully parsed. Falling back to plain text representation."));
    }

    if (parsed.length) {
      const headers = parsed[0] || [];
      parsed.forEach((row, index) => {
        if (!row.length) return;
        if (index > 0 && headers.length && row.length !== headers.length) {
          warnings.push(warning("CSV_MALFORMED_ROW", `Row ${index + 1} has ${row.length} columns; expected ${headers.length}.`, { rowNumber: index + 1 }));
        }

        const rowText = row
          .map((value, colIndex) => `${headers[colIndex] || `col_${colIndex + 1}`}: ${String(value ?? "").trim()}`)
          .join(" | ");
        sections.push(makeSection({ order: index, text: rowText, rowNumber: index + 1 }));
      });
    }

    if (!sections.length) {
      sections.push(makeSection({ order: 0, text: raw, pageNumber: 1 }));
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
      metadata: { rowCount: sections.length },
    };
  }
}
