import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { longDate, pesoText, ValidationError } from '@neofit/core';
import type { RevenueReport } from '../services/RevenueService';
import { ReportExporter } from './ReportExporter';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The monthly revenue report as a Word document (SDD Section 4.10): the same figures as the Revenue view. */
export class WordRevenueReport extends ReportExporter<RevenueReport> {
  readonly extension = 'docx';
  readonly contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  /** "Revenue-2026-11" for the file name. */
  static label(report: RevenueReport): string {
    return `Revenue-${report.year}-${String(report.month).padStart(2, '0')}`;
  }

  protected override validate(report: RevenueReport): void {
    if (!Number.isInteger(report.month) || report.month < 1 || report.month > 12) throw new ValidationError('Invalid report month.');
  }

  protected async render(report: RevenueReport, generatedAt: Date): Promise<Buffer> {
    const monthName = `${MONTHS[report.month - 1]} ${report.year}`;
    const share = (part: number) => (report.total > 0 ? `${((part / report.total) * 100).toFixed(1)}%` : '—');
    const change =
      report.previous.changePercent === null
        ? 'No revenue in the previous month to compare with'
        : `${report.previous.changePercent >= 0 ? '+' : ''}${report.previous.changePercent.toFixed(1)}% (${pesoText(Math.abs(report.previous.changePesos))} ${report.previous.changePesos >= 0 ? 'more' : 'less'}) than ${MONTHS[report.previous.month - 1]} ${report.previous.year}`;
    const generated = `${longDate(generatedAt.toISOString().slice(0, 10))}`;
    const activeDays = report.days.filter((d) => d.total > 0 || d.logbookCount > 0 || d.paymentCount > 0);

    const doc = new Document({
      creator: 'NeoFit Revenue System',
      title: `Revenue Report ${monthName}`,
      styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
      sections: [
        {
          children: [
            new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: 'NeoFit Fitness Gym', bold: true })] }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Revenue Report: ${monthName}`)] }),
            new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: `Generated on ${generated}`, color: '666666', size: 20 })] }),

            ...(report.logbookStale
              ? [
                  new Paragraph({
                    spacing: { after: 240 },
                    children: [
                      new TextRun({
                        text: 'Note: the logbook could not be refreshed from the cloud when this report was made, so the logbook figures may be missing or out of date. Member payments are complete.',
                        bold: true,
                        color: 'B00020',
                      }),
                    ],
                  }),
                ]
              : []),

            heading('Summary'),
            table(
              ['Item', 'Amount'],
              [
                ['Total revenue', pesoText(report.total)],
                ['Change from the previous month', change],
                ['Revenue from logbook scans', pesoText(report.logbookTotal)],
                ['Revenue from member payments', pesoText(report.paymentsTotal)],
                [`Year to date (${report.year})`, pesoText(report.yearTotal)],
              ],
              [60, 40],
              [1],
            ),

            heading('Revenue by source'),
            table(
              ['Source', 'Amount', 'Share'],
              [
                ['Logbook scans', pesoText(report.logbookTotal), share(report.logbookTotal)],
                ['Member payments', pesoText(report.paymentsTotal), share(report.paymentsTotal)],
              ],
              [50, 30, 20],
              [1, 2],
            ),

            heading('Revenue by plan'),
            report.byCategory.length === 0
              ? note('No revenue was recorded this month.')
              : table(
                  ['Plan', 'Amount', 'Share'],
                  report.byCategory.map((c) => [c.category, pesoText(c.revenue), share(c.revenue)]),
                  [50, 30, 20],
                  [1, 2],
                ),

            heading('Daily breakdown'),
            activeDays.length === 0
              ? note('No revenue was recorded this month.')
              : table(
                  ['Date', 'Logbook', 'Payments', 'Total'],
                  [
                    ...activeDays.map((d) => [longDate(d.date), pesoText(d.logbook), pesoText(d.payments), pesoText(d.total)]),
                    ['Total', pesoText(report.logbookTotal), pesoText(report.paymentsTotal), pesoText(report.total)],
                  ],
                  [34, 22, 22, 22],
                  [1, 2, 3],
                  true,
                ),

            new Paragraph({
              spacing: { before: 360 },
              children: [
                new TextRun({
                  text: 'Each payment is counted once. A member payment is left out when a logbook entry with the same member name is recorded on the same day.',
                  italics: true,
                  color: '666666',
                  size: 18,
                }),
              ],
            }),
          ],
        },
      ],
    });
    return Packer.toBuffer(doc);
  }
}

function heading(text: string): Paragraph {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 }, children: [new TextRun(text)] });
}

function note(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, color: '666666' })] });
}

const border = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
const borders = { top: border, bottom: border, left: border, right: border };

/** A table with a bold header row. `rightAligned` lists the columns that hold numbers; the last row can be a bold total. */
function table(header: string[], rows: string[][], widths: number[], rightAligned: number[] = [], totalRow = false): Table {
  const cell = (text: string, col: number, bold: boolean, shade?: string) =>
    new TableCell({
      borders,
      width: { size: widths[col] ?? 25, type: WidthType.PERCENTAGE },
      shading: shade ? { fill: shade } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [
        new Paragraph({
          alignment: rightAligned.includes(col) ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [new TextRun({ text, bold })],
        }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, true, 'E8EEF9')) }),
      ...rows.map((r, ri) => new TableRow({ children: r.map((t, i) => cell(t, i, totalRow && ri === rows.length - 1, totalRow && ri === rows.length - 1 ? 'F2F2F2' : undefined)) })),
    ],
  });
}
