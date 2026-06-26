import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { VestingScheduleService } from '../../src/modules/vesting-schedule/vesting-schedule.service';

const TENANT_ID = 'tenant-1';

const makePrisma = () => ({
  vestingSchedule: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
});

const standardSchedule = {
  name: 'Standard 4-Year',
  cliffMonths: 12,
  vestingDurationMonths: 48,
  vestingFrequency: 'MONTHLY' as const,
};

describe('VestingScheduleService', () => {
  let service: VestingScheduleService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new VestingScheduleService(prisma as any);
    prisma.vestingSchedule.create.mockResolvedValue({ id: 'vs-1', ...standardSchedule, tenantId: TENANT_ID });
  });

  describe('createVestingSchedule', () => {
    it('creates a valid vesting schedule', async () => {
      const result = await service.createVestingSchedule(TENANT_ID, standardSchedule);
      expect(result.id).toBe('vs-1');
      expect(prisma.vestingSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Standard 4-Year',
            cliffMonths: 12,
            vestingDurationMonths: 48,
            vestingFrequency: 'MONTHLY',
            tenantId: TENANT_ID,
          }),
        }),
      );
    });

    it('allows a schedule with no cliff (cliffMonths = 0)', async () => {
      await expect(
        service.createVestingSchedule(TENANT_ID, { ...standardSchedule, cliffMonths: 0 }),
      ).resolves.toBeDefined();
    });

    it('allows all vesting frequencies', async () => {
      for (const freq of ['MONTHLY', 'QUARTERLY', 'ANNUALLY'] as const) {
        await expect(
          service.createVestingSchedule(TENANT_ID, { ...standardSchedule, vestingFrequency: freq }),
        ).resolves.toBeDefined();
      }
    });

    it('trims whitespace from name', async () => {
      await service.createVestingSchedule(TENANT_ID, { ...standardSchedule, name: '  4-Year  ' });
      expect(prisma.vestingSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: '4-Year' }) }),
      );
    });

    it('throws BadRequestException for an empty name', async () => {
      await expect(
        service.createVestingSchedule(TENANT_ID, { ...standardSchedule, name: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when cliffMonths is negative', async () => {
      await expect(
        service.createVestingSchedule(TENANT_ID, { ...standardSchedule, cliffMonths: -1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when vestingDurationMonths is zero', async () => {
      await expect(
        service.createVestingSchedule(TENANT_ID, { ...standardSchedule, vestingDurationMonths: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when vestingDurationMonths is negative', async () => {
      await expect(
        service.createVestingSchedule(TENANT_ID, { ...standardSchedule, vestingDurationMonths: -12 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when cliff exceeds vesting duration', async () => {
      await expect(
        service.createVestingSchedule(TENANT_ID, { ...standardSchedule, cliffMonths: 24, vestingDurationMonths: 12 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows cliff equal to vesting duration (instant cliff)', async () => {
      await expect(
        service.createVestingSchedule(TENANT_ID, { ...standardSchedule, cliffMonths: 12, vestingDurationMonths: 12 }),
      ).resolves.toBeDefined();
    });
  });

  describe('listVestingSchedules', () => {
    it('returns all vesting schedules for the tenant', async () => {
      const schedules = [{ id: 'vs-1' }, { id: 'vs-2' }];
      prisma.vestingSchedule.findMany.mockResolvedValue(schedules);
      const result = await service.listVestingSchedules(TENANT_ID);
      expect(result).toEqual(schedules);
      expect(prisma.vestingSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_ID } }),
      );
    });
  });
});
