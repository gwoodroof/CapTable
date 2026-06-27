import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { CertificateService } from '../../common/certificate/certificate.service';
import { PrecisionMath, decimal } from '../../common/utils/math';
import { AuditTrail } from '../../common/utils/audit-trail';
import { TransactionType } from '@prisma/client';
import Decimal from 'decimal.js';

const SECURITY_TYPE_LABELS: Record<string, string> = {
  COMMON_STOCK: 'Common Stock',
  PREFERRED_STOCK: 'Preferred Stock',
  OPTION: 'Options',
  SAFE: 'SAFE',
  CONVERTIBLE_NOTE: 'Convertible Note',
  WARRANT: 'Warrant',
};

const CERT_ELIGIBLE_TYPES = new Set<TransactionType>([
  TransactionType.ISSUANCE,
  TransactionType.EXERCISE,
  TransactionType.TRANSFER,
]);

export interface BuyoutInput {
  sellerId: string;
  buyerId: string;
  securityId: string;
  quantity: string;
  pricePerShare: string;
}

export interface RecordTransactionInput {
  tenantId: string;
  transactionType: TransactionType;
  stakeholderId: string;
  securityId: string;
  quantity: string | number | Decimal;
  pricePerShare?: string | number | Decimal;
  initiatedBy?: string;
  grantId?: string;
  vestingPeriodIndex?: number;
  timestamp?: Date;
}

@Injectable()
export class LedgerService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private certificateService: CertificateService,
  ) {}

  async recordTransaction(input: RecordTransactionInput) {
    const { tenantId, transactionType, stakeholderId, securityId, quantity, pricePerShare, initiatedBy, grantId, vestingPeriodIndex, timestamp } = input;

    // Tenant table has no RLS — validate outside withTenant
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new BadRequestException(`Tenant not found: ${tenantId}`);
    }

    const quantityDecimal = decimal(quantity);
    if (!PrecisionMath.validateSharePrecision(quantityDecimal)) {
      throw new BadRequestException(`Share quantity exceeds precision limit (max 12 decimal places): ${quantity}`);
    }

    if (pricePerShare) {
      const priceDecimal = decimal(pricePerShare);
      if (!PrecisionMath.validatePricePrecision(priceDecimal)) {
        throw new BadRequestException(`Price per share exceeds precision limit (max 10 decimal places): ${pricePerShare}`);
      }
    }

    const effectiveTimestamp = timestamp ?? new Date();

    const txnData = {
      transactionType,
      stakeholderId,
      securityId,
      quantity: PrecisionMath.toString(quantityDecimal),
      pricePerShare: pricePerShare ? PrecisionMath.toString(decimal(pricePerShare)) : null,
      timestamp: effectiveTimestamp.toISOString(),
    };

    const dataHash = AuditTrail.computeDataHash(txnData);

    // Run all RLS-protected reads + the ledger insert inside one withTenant transaction
    const { ledgerEntry, stakeholder, security } = await this.prisma.withTenant(tenantId, async (tx) => {
      const stakeholder = await tx.stakeholder.findUnique({ where: { id: stakeholderId } });
      if (!stakeholder || stakeholder.tenantId !== tenantId) {
        throw new BadRequestException(`Stakeholder not found or does not belong to this tenant: ${stakeholderId}`);
      }

      const security = await tx.security.findUnique({ where: { id: securityId } });
      if (!security || security.tenantId !== tenantId) {
        throw new BadRequestException(`Security not found or does not belong to this tenant: ${securityId}`);
      }

      const previousEntry = await tx.ledgerTransaction.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });

      const previousRowHash = previousEntry?.chainHash || null;
      const chainHash = AuditTrail.computeChainHash(dataHash, previousRowHash);

      // Compute certificate number for cert-eligible transaction types
      let certificateNumber: string | null = null;
      if (CERT_ELIGIBLE_TYPES.has(transactionType)) {
        const existingCertCount = await tx.ledgerTransaction.count({
          where: { tenantId, certificateNumber: { not: null } },
        });
        certificateNumber = `CS-${(existingCertCount + 1).toString().padStart(4, '0')}`;
      }

      try {
        const ledgerEntry = await tx.ledgerTransaction.create({
          data: {
            tenantId,
            transactionType,
            stakeholderId,
            securityId,
            quantity: quantityDecimal,
            pricePerShare: pricePerShare ? decimal(pricePerShare) : null,
            grantId: grantId ?? null,
            vestingPeriodIndex: vestingPeriodIndex ?? null,
            timestamp: effectiveTimestamp,
            dataHash,
            previousRowHash: previousRowHash || null,
            chainHash,
            initiatedBy: initiatedBy || null,
            certificateNumber,
          },
        });
        return { ledgerEntry, stakeholder, security };
      } catch (error) {
        throw new InternalServerErrorException(
          `Failed to record ledger transaction: ${(error as Error).message}`,
        );
      }
    });

    // Email + optional certificate — all non-blocking
    if (stakeholder.email) {
      const securityLabel = security.name ?? (SECURITY_TYPE_LABELS[security.type] ?? security.type);
      const notificationParams = {
        to: stakeholder.email,
        stakeholderName: stakeholder.name,
        companyName: tenant.name,
        tenantId,
        transactionType,
        quantity: PrecisionMath.toString(quantityDecimal),
        securityLabel,
      };

      if (CERT_ELIGIBLE_TYPES.has(transactionType) && ledgerEntry.certificateNumber) {
        // Generate the PDF certificate then send email with it attached
        const certNumber = ledgerEntry.certificateNumber;
        ;(async () => {
          let pdfBuffer: Buffer | null = null;
          try {
            pdfBuffer = await this.certificateService.generate({
              certNumber,
              companyName: tenant.name,
              companyIconUrl: tenant.iconUrl ?? undefined,
              stakeholderName: stakeholder.name,
              quantity: PrecisionMath.toString(quantityDecimal),
              securityLabel,
              issueDate: effectiveTimestamp,
            });
          } catch {
            // Cert generation failure: send email without attachment
          }
          const attachments = pdfBuffer
            ? [{ Name: `certificate-${certNumber}.pdf`, Content: pdfBuffer.toString('base64'), ContentType: 'application/pdf' }]
            : undefined;
          await this.emailService.sendLedgerNotification(notificationParams, attachments);
        })().catch(() => {
          // Non-blocking: notification failure must never compromise ledger integrity
        });
      } else {
        // Non-cert transaction types: send email without attachment
        this.emailService.sendLedgerNotification(notificationParams).catch(() => {
          // Non-blocking
        });
      }
    }

    return ledgerEntry;
  }

  async getStakeholderBalance(
    tenantId: string,
    stakeholderId: string,
    securityId: string,
    asOf?: Date,
  ): Promise<Decimal> {
    const entries = await this.prisma.withTenant(tenantId, (tx) =>
      tx.ledgerTransaction.findMany({
        where: {
          tenantId,
          stakeholderId,
          securityId,
          ...(asOf && { timestamp: { lte: asOf } }),
        },
        orderBy: { timestamp: 'asc' },
      }),
    );

    let balance = new Decimal(0);
    for (const entry of entries) {
      switch (entry.transactionType) {
        case 'ISSUANCE':      balance = balance.plus(entry.quantity);  break;
        case 'VEST':          balance = balance.plus(entry.quantity);  break;
        case 'EXERCISE':      balance = balance.minus(entry.quantity); break;
        case 'TRANSFER':      balance = balance.minus(entry.quantity); break;
        case 'CANCELLATION':  balance = balance.minus(entry.quantity); break;
        case 'ADJUSTMENT':    balance = balance.plus(entry.quantity);  break;
      }
    }
    return balance;
  }

  async validateLedgerChain(tenantId: string): Promise<{ valid: boolean; errors: string[] }> {
    const entries = await this.prisma.withTenant(tenantId, (tx) =>
      tx.ledgerTransaction.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
      }),
    );

    const errors: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const previousEntry = i > 0 ? entries[i - 1] : null;

      const expectedPreviousHash = previousEntry?.chainHash || null;
      if (entry.previousRowHash !== expectedPreviousHash) {
        errors.push(`Entry ${entry.id} has incorrect previousRowHash (chain is broken at position ${i})`);
      }

      const isValid = AuditTrail.validateChainIntegrity(entry.dataHash, entry.previousRowHash, entry.chainHash);
      if (!isValid) {
        errors.push(`Entry ${entry.id} has invalid chain hash`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async getLedgerReportAsOf(tenantId: string, asOfDate: Date): Promise<any> {
    const entries = await this.prisma.withTenant(tenantId, (tx) =>
      tx.ledgerTransaction.findMany({
        where: { tenantId, timestamp: { lte: asOfDate } },
        orderBy: { timestamp: 'asc' },
        include: { stakeholder: true, security: true },
      }),
    );

    return {
      tenantId,
      asOfDate,
      transactionCount: entries.length,
      transactions: entries,
      generatedAt: new Date(),
    };
  }

  async getStakeholderHoldings(tenantId: string, stakeholderId: string) {
    const entries = await this.prisma.withTenant(tenantId, (tx) =>
      tx.ledgerTransaction.findMany({
        where: { tenantId, stakeholderId },
        include: { security: true },
        orderBy: { timestamp: 'asc' },
      }),
    );

    const map = new Map<string, { security: { id: string; type: string; name: string | null }; balance: Decimal }>();
    for (const entry of entries) {
      if (!map.has(entry.securityId)) {
        map.set(entry.securityId, { security: entry.security, balance: new Decimal(0) });
      }
      const item = map.get(entry.securityId)!;
      switch (entry.transactionType) {
        case 'ISSUANCE':     item.balance = item.balance.plus(entry.quantity);  break;
        case 'VEST':         item.balance = item.balance.plus(entry.quantity);  break;
        case 'EXERCISE':     item.balance = item.balance.minus(entry.quantity); break;
        case 'TRANSFER':     item.balance = item.balance.minus(entry.quantity); break;
        case 'CANCELLATION': item.balance = item.balance.minus(entry.quantity); break;
        case 'ADJUSTMENT':   item.balance = item.balance.plus(entry.quantity);  break;
      }
    }

    return Array.from(map.values())
      .filter(({ balance }) => balance.greaterThan(0))
      .map(({ security, balance }) => ({
        securityId: security.id,
        securityName: security.name ?? (SECURITY_TYPE_LABELS[security.type] ?? security.type),
        securityType: security.type,
        balance: PrecisionMath.toString(balance),
      }));
  }

  async buyoutPreview(tenantId: string, input: BuyoutInput) {
    const { sellerId, buyerId, securityId, quantity, pricePerShare } = input;

    if (sellerId === buyerId) {
      throw new BadRequestException('Seller and buyer must be different stakeholders.');
    }
    const qtyDecimal = decimal(quantity);
    if (qtyDecimal.lte(0)) throw new BadRequestException('Quantity must be greater than zero.');
    const priceDecimal = decimal(pricePerShare);
    if (priceDecimal.lte(0)) throw new BadRequestException('Price per share must be greater than zero.');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException(`Tenant not found: ${tenantId}`);

    return this.prisma.withTenant(tenantId, async (tx) => {
      const seller = await tx.stakeholder.findUnique({ where: { id: sellerId } });
      if (!seller || seller.tenantId !== tenantId) throw new BadRequestException('Seller not found.');

      const buyer = await tx.stakeholder.findUnique({ where: { id: buyerId } });
      if (!buyer || buyer.tenantId !== tenantId) throw new BadRequestException('Buyer not found.');

      const security = await tx.security.findUnique({ where: { id: securityId } });
      if (!security || security.tenantId !== tenantId) throw new BadRequestException('Security not found.');

      const sellerEntries = await tx.ledgerTransaction.findMany({
        where: { tenantId, stakeholderId: sellerId, securityId },
        orderBy: { timestamp: 'asc' },
      });

      let sellerBalance = new Decimal(0);
      const issuances: typeof sellerEntries = [];
      for (const e of sellerEntries) {
        switch (e.transactionType) {
          case 'ISSUANCE':     sellerBalance = sellerBalance.plus(e.quantity);  break;
          case 'VEST':         sellerBalance = sellerBalance.plus(e.quantity);  break;
          case 'EXERCISE':     sellerBalance = sellerBalance.minus(e.quantity); break;
          case 'TRANSFER':     sellerBalance = sellerBalance.minus(e.quantity); break;
          case 'CANCELLATION': sellerBalance = sellerBalance.minus(e.quantity); break;
          case 'ADJUSTMENT':   sellerBalance = sellerBalance.plus(e.quantity);  break;
        }
        if (e.transactionType === 'ISSUANCE') issuances.push(e);
      }

      if (qtyDecimal.gt(sellerBalance)) {
        throw new BadRequestException(
          `Insufficient balance: seller has ${PrecisionMath.toString(sellerBalance)} shares, cannot transfer ${quantity}.`,
        );
      }

      return {
        seller: { id: seller.id, name: seller.name, email: seller.email },
        buyer: { id: buyer.id, name: buyer.name, email: buyer.email },
        security: { id: security.id, type: security.type, name: security.name },
        sellerBalance: PrecisionMath.toString(sellerBalance),
        quantity,
        pricePerShare,
        totalConsideration: PrecisionMath.toString(qtyDecimal.times(priceDecimal)),
        sellerIssuances: issuances.map((e) => ({
          id: e.id,
          timestamp: e.timestamp.toISOString(),
          quantity: PrecisionMath.toString(decimal(e.quantity)),
          pricePerShare: e.pricePerShare ? PrecisionMath.toString(decimal(e.pricePerShare)) : null,
        })),
      };
    });
  }

  async buyoutCommit(tenantId: string, input: BuyoutInput, initiatedBy?: string) {
    const { sellerId, buyerId, securityId, quantity, pricePerShare } = input;

    if (sellerId === buyerId) {
      throw new BadRequestException('Seller and buyer must be different stakeholders.');
    }
    const qtyDecimal = decimal(quantity);
    if (qtyDecimal.lte(0)) throw new BadRequestException('Quantity must be greater than zero.');
    const priceDecimal = decimal(pricePerShare);
    if (priceDecimal.lte(0)) throw new BadRequestException('Price per share must be greater than zero.');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException(`Tenant not found: ${tenantId}`);

    const now = new Date();

    const { cancellationEntry, issuanceEntry, buyer, security } = await this.prisma.withTenant(tenantId, async (tx) => {
      const seller = await tx.stakeholder.findUnique({ where: { id: sellerId } });
      if (!seller || seller.tenantId !== tenantId) throw new BadRequestException('Seller not found.');

      const buyer = await tx.stakeholder.findUnique({ where: { id: buyerId } });
      if (!buyer || buyer.tenantId !== tenantId) throw new BadRequestException('Buyer not found.');

      const security = await tx.security.findUnique({ where: { id: securityId } });
      if (!security || security.tenantId !== tenantId) throw new BadRequestException('Security not found.');

      // Re-validate seller balance at commit time
      const sellerEntries = await tx.ledgerTransaction.findMany({
        where: { tenantId, stakeholderId: sellerId, securityId },
        orderBy: { timestamp: 'asc' },
      });
      let sellerBalance = new Decimal(0);
      for (const e of sellerEntries) {
        switch (e.transactionType) {
          case 'ISSUANCE':     sellerBalance = sellerBalance.plus(e.quantity);  break;
          case 'VEST':         sellerBalance = sellerBalance.plus(e.quantity);  break;
          case 'EXERCISE':     sellerBalance = sellerBalance.minus(e.quantity); break;
          case 'TRANSFER':     sellerBalance = sellerBalance.minus(e.quantity); break;
          case 'CANCELLATION': sellerBalance = sellerBalance.minus(e.quantity); break;
          case 'ADJUSTMENT':   sellerBalance = sellerBalance.plus(e.quantity);  break;
        }
      }
      if (qtyDecimal.gt(sellerBalance)) {
        throw new BadRequestException(
          `Insufficient balance at commit time: seller has ${PrecisionMath.toString(sellerBalance)} shares.`,
        );
      }

      const lastEntry = await tx.ledgerTransaction.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });

      // ── CANCELLATION for seller ──
      const cancelTxnData = {
        transactionType: 'CANCELLATION',
        stakeholderId: sellerId,
        securityId,
        quantity: PrecisionMath.toString(qtyDecimal),
        pricePerShare: null,
        timestamp: now.toISOString(),
      };
      const cancelDataHash = AuditTrail.computeDataHash(cancelTxnData);
      const cancelPrevHash = lastEntry?.chainHash ?? null;
      const cancelChainHash = AuditTrail.computeChainHash(cancelDataHash, cancelPrevHash);

      const cancellationEntry = await tx.ledgerTransaction.create({
        data: {
          tenantId,
          transactionType: TransactionType.CANCELLATION,
          stakeholderId: sellerId,
          securityId,
          quantity: qtyDecimal,
          pricePerShare: null,
          timestamp: now,
          dataHash: cancelDataHash,
          previousRowHash: cancelPrevHash,
          chainHash: cancelChainHash,
          initiatedBy: initiatedBy ?? null,
          certificateNumber: null,
        },
      });

      // ── ISSUANCE for buyer (cert-eligible) ──
      const certCount = await tx.ledgerTransaction.count({
        where: { tenantId, certificateNumber: { not: null } },
      });
      const certNumber = `CS-${(certCount + 1).toString().padStart(4, '0')}`;

      const issuanceTxnData = {
        transactionType: 'ISSUANCE',
        stakeholderId: buyerId,
        securityId,
        quantity: PrecisionMath.toString(qtyDecimal),
        pricePerShare: PrecisionMath.toString(priceDecimal),
        timestamp: now.toISOString(),
      };
      const issuanceDataHash = AuditTrail.computeDataHash(issuanceTxnData);
      const issuancePrevHash = cancellationEntry.chainHash;
      const issuanceChainHash = AuditTrail.computeChainHash(issuanceDataHash, issuancePrevHash);

      const issuanceEntry = await tx.ledgerTransaction.create({
        data: {
          tenantId,
          transactionType: TransactionType.ISSUANCE,
          stakeholderId: buyerId,
          securityId,
          quantity: qtyDecimal,
          pricePerShare: priceDecimal,
          timestamp: now,
          dataHash: issuanceDataHash,
          previousRowHash: issuancePrevHash,
          chainHash: issuanceChainHash,
          initiatedBy: initiatedBy ?? null,
          certificateNumber: certNumber,
        },
      });

      return { cancellationEntry, issuanceEntry, buyer, security };
    });

    // Fire cert+email for buyer — non-blocking, same pattern as recordTransaction
    if (buyer.email) {
      const securityLabel = security.name ?? (SECURITY_TYPE_LABELS[security.type] ?? security.type);
      const notificationParams = {
        to: buyer.email,
        stakeholderName: buyer.name,
        companyName: tenant.name,
        tenantId,
        transactionType: 'ISSUANCE',
        quantity: PrecisionMath.toString(qtyDecimal),
        securityLabel,
      };
      const certNumber = issuanceEntry.certificateNumber!;
      ;(async () => {
        let pdfBuffer: Buffer | null = null;
        try {
          pdfBuffer = await this.certificateService.generate({
            certNumber,
            companyName: tenant.name,
            companyIconUrl: tenant.iconUrl ?? undefined,
            stakeholderName: buyer.name,
            quantity: PrecisionMath.toString(qtyDecimal),
            securityLabel,
            issueDate: now,
          });
        } catch {
          // Cert generation failure: send email without attachment
        }
        const attachments = pdfBuffer
          ? [{ Name: `certificate-${certNumber}.pdf`, Content: pdfBuffer.toString('base64'), ContentType: 'application/pdf' }]
          : undefined;
        await this.emailService.sendLedgerNotification(notificationParams, attachments);
      })().catch(() => {});
    }

    return { cancellationEntry, issuanceEntry };
  }
}
