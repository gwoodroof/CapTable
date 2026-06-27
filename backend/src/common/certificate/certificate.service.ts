import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface CertificateParams {
  certNumber: string;
  companyName: string;
  companyIconUrl?: string;
  stakeholderName: string;
  quantity: string;
  securityLabel: string;
  issueDate: Date;
}

const NAVY = '#1a3a6b';
const GOLD = '#c8a94c';
const W = 792;
const H = 612;
const M = 36;

@Injectable()
export class CertificateService {
  async generate(params: CertificateParams): Promise<Buffer> {
    const iconBuffer = params.companyIconUrl ? await this.fetchImage(params.companyIconUrl) : null;
    return this.buildPdf(params, iconBuffer);
  }

  private async fetchImage(url: string): Promise<Buffer | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  private buildPdf(params: CertificateParams, iconBuffer: Buffer | null): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margins: { top: M, bottom: M, left: M, right: M },
        autoFirstPage: true,
        info: { Title: `Stock Certificate ${params.certNumber}`, Author: params.companyName },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.drawBorder(doc);
      this.drawContent(doc, params, iconBuffer);

      doc.end();
    });
  }

  private drawBorder(doc: PDFKit.PDFDocument): void {
    // Outer border
    doc.rect(M, M, W - 2 * M, H - 2 * M).lineWidth(4).strokeColor(NAVY).stroke();
    // Gold accent border
    doc.rect(M + 7, M + 7, W - 2 * (M + 7), H - 2 * (M + 7)).lineWidth(1.5).strokeColor(GOLD).stroke();
    // Inner border
    doc.rect(M + 11, M + 11, W - 2 * (M + 11), H - 2 * (M + 11)).lineWidth(0.5).strokeColor(NAVY).stroke();

    // Corner ornaments — small diamond shapes at each corner
    const corners = [
      [M + 2, M + 2],
      [W - M - 2, M + 2],
      [M + 2, H - M - 2],
      [W - M - 2, H - M - 2],
    ] as const;
    const r = 5;
    for (const [cx, cy] of corners) {
      doc
        .moveTo(cx, cy - r)
        .lineTo(cx + r, cy)
        .lineTo(cx, cy + r)
        .lineTo(cx - r, cy)
        .closePath()
        .fillColor(GOLD)
        .fill();
    }
  }

  private drawContent(doc: PDFKit.PDFDocument, params: CertificateParams, iconBuffer: Buffer | null): void {
    const pad = M + 20; // content left/right padding
    const contentW = W - 2 * pad;
    let y = M + 22;

    // --- HEADER ---
    const iconSize = 50;

    // Company icon or monogram (left side)
    if (iconBuffer) {
      try {
        doc.image(iconBuffer, pad, y, { width: iconSize, height: iconSize });
      } catch {
        this.drawMonogram(doc, params.companyName, pad, y, iconSize);
      }
    } else {
      this.drawMonogram(doc, params.companyName, pad, y, iconSize);
    }

    // Company name (centered in remaining space)
    doc
      .font('Times-Bold')
      .fontSize(17)
      .fillColor(NAVY)
      .text(params.companyName.toUpperCase(), pad + iconSize + 12, y + 14, {
        width: contentW - iconSize - 12 - 90,
        align: 'left',
        lineBreak: false,
      });

    // Certificate number (top right)
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#777777')
      .text('No.', W - pad - 78, y + 8, { continued: true })
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(NAVY)
      .text(` ${params.certNumber}`, { width: 78, align: 'right' });

    y += iconSize + 14;

    // Separator — double line (gold + navy)
    doc.moveTo(pad, y).lineTo(pad + contentW, y).lineWidth(1).strokeColor(GOLD).stroke();
    y += 3;
    doc.moveTo(pad, y).lineTo(pad + contentW, y).lineWidth(0.5).strokeColor(NAVY).stroke();
    y += 14;

    // --- TITLE ---
    doc
      .font('Times-Bold')
      .fontSize(24)
      .fillColor(NAVY)
      .text('STOCK CERTIFICATE', 0, y, { width: W, align: 'center' });
    y += 36;

    // Separator
    doc.moveTo(pad, y).lineTo(pad + contentW, y).lineWidth(0.5).strokeColor(NAVY).stroke();
    y += 3;
    doc.moveTo(pad, y).lineTo(pad + contentW, y).lineWidth(1).strokeColor(GOLD).stroke();
    y += 20;

    // --- BODY ---
    doc
      .font('Times-Roman')
      .fontSize(10)
      .fillColor('#444444')
      .text('THIS CERTIFIES THAT', 0, y, { width: W, align: 'center', characterSpacing: 2.5 });
    y += 20;

    doc
      .font('Times-BoldItalic')
      .fontSize(22)
      .fillColor(NAVY)
      .text(params.stakeholderName, 0, y, { width: W, align: 'center' });
    y += 32;

    doc
      .font('Times-Roman')
      .fontSize(10)
      .fillColor('#444444')
      .text('IS THE REGISTERED HOLDER OF', 0, y, { width: W, align: 'center', characterSpacing: 2 });
    y += 20;

    const formattedQty = Number(params.quantity).toLocaleString('en-US', { maximumFractionDigits: 4 });
    doc
      .font('Times-Bold')
      .fontSize(20)
      .fillColor(NAVY)
      .text(`${formattedQty} Shares of ${params.securityLabel}`, 0, y, { width: W, align: 'center' });
    y += 34;

    doc
      .font('Times-Roman')
      .fontSize(9)
      .fillColor('#777777')
      .text('ISSUED ON', 0, y, { width: W, align: 'center', characterSpacing: 2 });
    y += 15;

    const dateStr = params.issueDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc
      .font('Times-Roman')
      .fontSize(14)
      .fillColor(NAVY)
      .text(dateStr, 0, y, { width: W, align: 'center' });

    // --- FOOTER ---
    const footerY = H - M - 26;
    doc.moveTo(pad, footerY).lineTo(pad + contentW, footerY).lineWidth(0.5).strokeColor(GOLD).stroke();

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#aaaaaa')
      .text(
        `This certificate is issued pursuant to the company's articles of incorporation and applicable securities laws. ` +
          `${params.companyName} — Certificate No. ${params.certNumber}`,
        pad,
        footerY + 7,
        { width: contentW, align: 'center' },
      );
  }

  private drawMonogram(
    doc: PDFKit.PDFDocument,
    name: string,
    x: number,
    y: number,
    size: number,
  ): void {
    const letter = (name[0] ?? '?').toUpperCase();
    doc.rect(x, y, size, size).fillColor(NAVY).fill();
    doc
      .font('Times-Bold')
      .fontSize(Math.floor(size * 0.55))
      .fillColor('#ffffff')
      .text(letter, x, y + size * 0.2, { width: size, align: 'center', lineBreak: false });
  }
}
