import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
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

export interface RecordTransactionInput {
  tenantId: string;
  transactionType: TransactionType;
  stakeholderId: string;
  securityId: string;
  quantity: string | number | Decimal;
  pricePerShare?: string | number | Decimal;
  initiatedBy?: string;
}

@Injectable()
export class LedgerService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async recordTransaction(input: RecordTransactionInput) {
    const { tenantId, transactionType, stakeholderId, securityId, quantity, pricePerShare, initiatedBy } = input;

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

    const txnData = {
      transactionType,
      stakeholderId,
      securityId,
      quantity: PrecisionMath.toString(quantityDecimal),
      pricePerShare: pricePerShare ? PrecisionMath.toString(decimal(pricePerShare)) : null,
      timestamp: new Date().toISOString(),
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

      try {
        const ledgerEntry = await tx.ledgerTransaction.create({
          data: {
            tenantId,
            transactionType,
            stakeholderId,
            securityId,
            quantity: quantityDecimal,
            pricePerShare: pricePerShare ? decimal(pricePerShare) : null,
            dataHash,
            previousRowHash: previousRowHash || null,
            chainHash,
            initiatedBy: initiatedBy || null,
          },
        });
        return { ledgerEntry, stakeholder, security };
      } catch (error) {
        throw new InternalServerErrorException(
          `Failed to record ledger transaction: ${(error as Error).message}`,
        );
      }
    });

    // Email notification is non-blocking — send outside the transaction
    if (stakeholder.email) {
      const securityLabel = security.name ?? (SECURITY_TYPE_LABELS[security.type] ?? security.type);
      this.emailService
        .sendLedgerNotification({
          to: stakeholder.email,
          stakeholderName: stakeholder.name,
          companyName: tenant.name,
          tenantId,
          transactionType,
          quantity: PrecisionMath.toString(quantityDecimal),
          securityLabel,
        })
        .catch(() => {
          // Non-blocking: a notification failure must never compromise ledger integrity
        });
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
}
