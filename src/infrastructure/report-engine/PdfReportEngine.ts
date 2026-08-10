import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { ReportEngine } from "@/domain/repositories/ReportEngine";
import { SavedAssessmentResult } from "@/domain/entities/AssessmentResult";
import { CategoryScore, PriorityItem } from "@/domain/entities/Score";
import { Insight } from "@/domain/value-objects/Insight";
import { SavedLead } from "@/domain/entities/Lead";

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 56;

const INK = rgb(0.11, 0.13, 0.18);
const MUTED = rgb(0.42, 0.45, 0.5);
const ACCENT = rgb(0.15, 0.35, 0.98);
const TRACK = rgb(0.89, 0.9, 0.93);

/**
 * Adapter: renders a scored assessment result as a one-page PDF report.
 *
 * Renders directly from the same canonical AssessmentScoreResult the
 * web results page renders (scoreDisplay, categoryScores, roles,
 * topPriorities, scoreInterpretation) — no independent PDF-only
 * derivation of "biggest opportunity"/"biggest constraint" happens
 * here. That is what guarantees the PDF and the web page can never
 * disagree about a result.
 */
export class PdfReportEngine implements ReportEngine {
  async generate(result: SavedAssessmentResult, lead?: SavedLead): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = PAGE_HEIGHT - MARGIN;

    y = this.drawHeader(page, bold, regular, y, lead);
    y -= 28;
    y = this.drawOverallScore(page, bold, regular, y, result);
    y -= 30;
    y = this.drawCategoryScores(page, bold, regular, y, result.categoryScores);
    y -= 20;
    y = this.drawSummary(page, bold, regular, y, result);
    y -= 16;
    y = this.drawRecommendations(page, bold, regular, y, result.topPriorities);

    this.drawFooter(page, regular);

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }

  private drawHeader(
    page: PDFPage,
    bold: PDFFont,
    regular: PDFFont,
    y: number,
    lead?: SavedLead
  ): number {
    page.drawText("Business Minded", {
      x: MARGIN,
      y,
      size: 12,
      font: bold,
      color: ACCENT,
    });
    y -= 26;
    page.drawText("Business Health Check Report", {
      x: MARGIN,
      y,
      size: 22,
      font: bold,
      color: INK,
    });
    y -= 20;
    const subtitle = lead
      ? `Prepared for ${lead.firstName}${lead.company ? ` · ${lead.company}` : ""}`
      : "Confidential business assessment summary";
    page.drawText(subtitle, {
      x: MARGIN,
      y,
      size: 11,
      font: regular,
      color: MUTED,
    });
    y -= 14;
    const dateLabel = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    page.drawText(dateLabel, { x: MARGIN, y, size: 10, font: regular, color: MUTED });

    y -= 10;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1,
      color: TRACK,
    });
    return y;
  }

  private drawOverallScore(
    page: PDFPage,
    bold: PDFFont,
    regular: PDFFont,
    y: number,
    result: SavedAssessmentResult
  ): number {
    page.drawText("Business Minded Score", {
      x: MARGIN,
      y,
      size: 13,
      font: bold,
      color: INK,
    });
    y -= 34;

    const { scoreDisplay } = result;

    if (scoreDisplay.suppressed || scoreDisplay.value === null) {
      page.drawText("Not enough answers yet", {
        x: MARGIN,
        y,
        size: 20,
        font: bold,
        color: MUTED,
      });
      y -= 18;
      page.drawText(
        `Based on ${scoreDisplay.answeredQuestionCount} of ${scoreDisplay.totalQuestionCount} answers`,
        { x: MARGIN, y, size: 10, font: regular, color: MUTED }
      );
      return y;
    }

    page.drawText(`${scoreDisplay.value}`, {
      x: MARGIN,
      y,
      size: 46,
      font: bold,
      color: ACCENT,
    });
    page.drawText("/ 100", {
      x: MARGIN + 78,
      y: y + 10,
      size: 14,
      font: regular,
      color: MUTED,
    });

    if (scoreDisplay.answeredQuestionCount < scoreDisplay.totalQuestionCount) {
      y -= 20;
      page.drawText(
        `Based on ${scoreDisplay.answeredQuestionCount} of ${scoreDisplay.totalQuestionCount} answers`,
        { x: MARGIN, y, size: 9, font: regular, color: MUTED }
      );
    }

    return y;
  }

  private drawCategoryScores(
    page: PDFPage,
    bold: PDFFont,
    regular: PDFFont,
    y: number,
    categoryScores: CategoryScore[]
  ): number {
    page.drawText("Category Scores", { x: MARGIN, y, size: 13, font: bold, color: INK });
    y -= 20;

    const barX = MARGIN + 170;
    const barWidth = PAGE_WIDTH - MARGIN - barX - 40;
    const barHeight = 8;

    for (const category of categoryScores) {
      const label =
        category.status === "Insufficient data"
          ? `${category.categoryName} (insufficient data)`
          : category.reducedConfidence
            ? `${category.categoryName} (partial)`
            : category.categoryName;

      page.drawText(label, {
        x: MARGIN,
        y: y + 1,
        size: 10,
        font: regular,
        color: category.status === "Insufficient data" ? MUTED : INK,
        maxWidth: 160,
      });

      if (category.status === "Insufficient data") {
        page.drawText("—", {
          x: PAGE_WIDTH - MARGIN - 24,
          y: y + 1,
          size: 10,
          font: bold,
          color: MUTED,
        });
      } else {
        page.drawRectangle({ x: barX, y, width: barWidth, height: barHeight, color: TRACK });
        page.drawRectangle({
          x: barX,
          y,
          width: (barWidth * Math.min(Math.max(category.score, 0), 20)) / 20,
          height: barHeight,
          color: ACCENT,
        });
        page.drawText(`${category.score}`, {
          x: PAGE_WIDTH - MARGIN - 24,
          y: y + 1,
          size: 10,
          font: bold,
          color: INK,
        });
      }

      y -= 22;
    }

    return y;
  }

  private drawSummary(
    page: PDFPage,
    bold: PDFFont,
    regular: PDFFont,
    y: number,
    result: SavedAssessmentResult
  ): number {
    page.drawText("Summary", { x: MARGIN, y, size: 13, font: bold, color: INK });
    y -= 18;

    const { roles } = result;

    if (roles.tieState !== "none" && roles.tieMessage) {
      y = this.drawWrappedText(
        page,
        regular,
        roles.tieMessage,
        MARGIN,
        y,
        PAGE_WIDTH - MARGIN * 2,
        10,
        MUTED
      );
      y -= 10;
    } else {
      y = this.drawInsightBlock(page, bold, regular, y, "What's Working", roles.strength);
      y -= 10;
      y = this.drawInsightBlock(page, bold, regular, y, "Biggest Constraint", roles.constraint);
      y -= 10;
      y = this.drawInsightBlock(page, bold, regular, y, "Biggest Opportunity", roles.opportunity);
      y -= 10;
    }

    page.drawText(`Assessment Completeness: ${result.confidenceLevel}`, {
      x: MARGIN,
      y,
      size: 10,
      font: regular,
      color: MUTED,
    });

    return y;
  }

  private drawInsightBlock(
    page: PDFPage,
    bold: PDFFont,
    regular: PDFFont,
    y: number,
    label: string,
    insight: Insight | null
  ): number {
    if (!insight) {
      page.drawText(`${label}: not enough distinct data to call out`, {
        x: MARGIN,
        y,
        size: 10,
        font: regular,
        color: MUTED,
      });
      return y - 14;
    }

    page.drawText(`${label}: ${insight.headline}`, {
      x: MARGIN,
      y,
      size: 11,
      font: bold,
      color: INK,
    });
    y -= 14;
    return this.drawWrappedText(
      page,
      regular,
      insight.description,
      MARGIN,
      y,
      PAGE_WIDTH - MARGIN * 2,
      10,
      MUTED
    );
  }

  private drawRecommendations(
    page: PDFPage,
    bold: PDFFont,
    regular: PDFFont,
    y: number,
    topPriorities: PriorityItem[]
  ): number {
    page.drawText("Top Priorities", {
      x: MARGIN,
      y,
      size: 13,
      font: bold,
      color: INK,
    });
    y -= 18;

    if (topPriorities.length === 0) {
      page.drawText("Not enough answers yet to generate priorities.", {
        x: MARGIN,
        y,
        size: 10,
        font: regular,
        color: MUTED,
      });
      return y - 14;
    }

    topPriorities.forEach((priority, index) => {
      page.drawText(`${index + 1}.`, { x: MARGIN, y, size: 10, font: bold, color: ACCENT });
      y = this.drawWrappedText(
        page,
        regular,
        `${priority.action} (Dimension: ${priority.categoryName}, ${priority.timeframe})`,
        MARGIN + 16,
        y,
        PAGE_WIDTH - MARGIN * 2 - 16,
        10,
        INK
      );
      y -= 6;
    });

    return y;
  }

  private drawFooter(page: PDFPage, regular: PDFFont) {
    page.drawLine({
      start: { x: MARGIN, y: MARGIN },
      end: { x: PAGE_WIDTH - MARGIN, y: MARGIN },
      thickness: 1,
      color: TRACK,
    });
    page.drawText("Generated by Business Minded", {
      x: MARGIN,
      y: MARGIN - 16,
      size: 9,
      font: regular,
      color: MUTED,
    });
  }

  /** Minimal word-wrap helper — pdf-lib has no built-in text wrapping. */
  private drawWrappedText(
    page: PDFPage,
    font: PDFFont,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    size: number,
    color: ReturnType<typeof rgb>
  ): number {
    const words = text.split(" ");
    let line = "";
    let cursorY = y;

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, size);
      if (width > maxWidth && line) {
        page.drawText(line, { x, y: cursorY, size, font, color });
        cursorY -= size + 4;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
      cursorY -= size + 4;
    }
    return cursorY;
  }
}
