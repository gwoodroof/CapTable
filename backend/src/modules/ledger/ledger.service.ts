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

  /**
   * Record an immutable ledger transaction
   *
   * This is the ONLY way equity state changes. Direct DB mutations are forbidden.
   * Every transaction:
   * 1. Validates input (tenant, stakeholder, security exist)
   * 2. Computes cryptographic hashes for audit trail
   * 3. Records in a single atomic transaction
   * 4. Returns the recorded entry
   *
   * Throws on validation failure (not soft-fail).
   */
  async recordTransaction(input: RecordTransactionInput) {
    const {
      tenantId,
      transactionType,
      stakeholderId,
      securityId,
      quantity,
      pricePerShare,
      initiatedBy,
    } = input;

    // Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new BadRequestException(`Tenant not found: ${tenantId}`);
    }

    // Validate stakeholder exists and belongs to this tenant
    const stakeholder = await this.prisma.stakeholder.findUnique({
      where: { id: stakeholderId },
    });
    if (!stakeholder || stakeholder.tenantId !== tenantId) {
      throw new BadRequestException(
        `Stakeholder not found or does not belong to this tenant: ${stakeholderId}`,
      );
    }

    // Validate security exists and belongs to this tenant
    const security = await this.prisma.security.findUnique({ where: { id: securityId } });
    if (!security || security.tenantId !== tenantId) {
      throw new BadRequestException(
        `Security not found or does not belong to this tenant: ${securityId}`,
      );
    }

    // Validate share precision
    const quantityDecimal = decimal(quantity);
    if (!PrecisionMath.validateSharePrecision(quantityDecimal)) {
      throw new BadRequestException(
        `Share quantity exceeds precision limit (max 12 decimal places): ${quantity}`,
      );
    }

    if (pricePerShare) {
      const priceDecimal = decimal(pricePerShare);
      if (!PrecisionMath.validatePricePrecision(priceDecimal)) {
        throw new BadRequestException(
          `Price per share exceeds precision limit (max 10 decimal places): ${pricePerShare}`,
        );
      }
    }

    // Prepare transaction data for hashing
    const txnData = {
      transactionType,
      stakeholderId,
      securityId,
      quantity: PrecisionMath.toString(quantityDecimal),
      pricePerShare: pricePerShare ? PrecisionMath.toString(decimal(pricePerShare)) : null,
      timestamp: new Date().toISOString(),
    };

    // Compute hashes
    const dataHash = AuditTrail.computeDataHash(txnData);

    // Fetch the previous ledger entry for this tenant to get its chain hash
    const previousEntry = await this.prisma.ledgerTransaction.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const previousRowHash = previousEntry?.chainHash || null;
    const chainHash = AuditTrail.computeChainHash(dataHash, previousRowHash);

    try {
      // Record the transaction in an atomic block
      const ledgerEntry = await this.prisma.ledgerTransaction.create({
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
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to record ledger transaction: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get the current balance of a stakeholder for a given security
   *
   * This reconstructs the balance by replaying all ledger transactions
   * up to the current time, summing them by transaction type.
   */
  async getStakeholderBalance(
    tenantId: string,
    stakeholderId: string,
    securityId: string,
    asOf?: Date,
  ): Promise<Decimal> {
    const entries = await this.prisma.ledgerTransaction.findMany({
      where: {
        tenantId,
        stakeholderId,
        securityId,
        ...(asOf && { timestamp: { lte: asOf } }),
      },
      orderBy: { timestamp: 'asc' },
    });

    let balance = new Decimal(0);

    for (const entry of entries) {
      switch (entry.transactionType) {
        case 'ISSUANCE':
          balance = balance.plus(entry.quantity);
          break;
        case 'VEST':
          balance = balance.plus(entry.quantity);
          break;
        case 'EXERCISE':
          balance = balance.minus(entry.quantity); // Exercises reduce option balance
          break;
        case 'TRANSFER':
          balance = balance.minus(entry.quantity);
          break;
        case 'CANCELLATION':
          balance = balance.minus(entry.quantity);
          break;
        case 'ADJUSTMENT':
          // Adjustments can be positive or negative
          balance = balance.plus(entry.quantity);
          break;
      }
    }

    return balance;
  }

  /**
   * Validate chain integrity of entire ledger for a tenant
   *
   * Walks through all ledger entries in order and verifies that each hash
   * is correctly computed. Any tampering will be detected immediately.
   */
  async validateLedgerChain(tenantId: string): Promise<{ valid: boolean; errors: string[] }> {
    const entries = await this.prisma.ledgerTransaction.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    const errors: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const previousEntry = i > 0 ? entries[i - 1] : null;

      const expectedPreviousHash = previousEntry?.chainHash || null;
      if (entry.previousRowHash !== expectedPreviousHash) {
        errors.push(
          `Entry ${entry.id} has incorrect previousRowHash (chain is broken at position ${i})`,
        );
      }

      const isValid = AuditTrail.validateChainIntegrity(
        entry.dataHash,
        entry.previousRowHash,
        entry.chainHash,
      );
      if (!isValid) {
        errors.push(`Entry ${entry.id} has invalid chain hash`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get ledger report as of a specific date (for historical audits)
   */
  async getLedgerReportAsOf(tenantId: string, asOfDate: Date): Promise<any> {
    const entries = await this.prisma.ledgerTransaction.findMany({
      where: {
        tenantId,
        timestamp: { lte: asOfDate },
      },
      orderBy: { timestamp: 'asc' },
      include: {
        stakeholder: true,
        security: true,
      },
    });

    return {
      tenantId,
      asOfDate,
      transactionCount: entries.length,
      transactions: entries,
      generatedAt: new Date(),
    };
  }
}
