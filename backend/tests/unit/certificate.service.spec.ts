import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CertificateService, CertificateParams } from '../../src/common/certificate/certificate.service';

const baseParams: CertificateParams = {
  certNumber: 'CS-0001',
  companyName: 'Acme Corp',
  stakeholderName: 'Alice Smith',
  quantity: '10000',
  securityLabel: 'Common Stock',
  issueDate: new Date('2026-01-15T00:00:00Z'),
};

describe('CertificateService', () => {
  let service: CertificateService;

  beforeEach(() => {
    service = new CertificateService();
    // Stub global fetch so network calls do not escape unit tests
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('generate', () => {
    it('returns a non-empty Buffer for params without an icon URL', async () => {
      const buf = await service.generate(baseParams);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(0);
    });

    it('PDF buffer begins with the %PDF- magic bytes', async () => {
      const buf = await service.generate(baseParams);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('does not call fetch when companyIconUrl is not provided', async () => {
      await service.generate(baseParams);
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });

    it('calls fetch with the icon URL when companyIconUrl is provided', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      } as Response);

      await service.generate({ ...baseParams, companyIconUrl: 'https://example.com/icon.png' });
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'https://example.com/icon.png',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('falls back to monogram gracefully when icon fetch fails', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
      const buf = await service.generate({ ...baseParams, companyIconUrl: 'https://example.com/icon.png' });
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(0);
    });

    it('falls back to monogram when icon fetch returns non-ok status', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
      const buf = await service.generate({ ...baseParams, companyIconUrl: 'https://example.com/bad.png' });
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(0);
    });

    it('still generates a valid PDF when icon fetch returns data (valid or not)', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(16),
      } as unknown as Response);

      const buf = await service.generate({ ...baseParams, companyIconUrl: 'https://example.com/icon.png' });
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('generates a valid PDF for large share quantities', async () => {
      // Content stream is FlateDecode-compressed — just verify the PDF is well-formed
      const buf = await service.generate({ ...baseParams, quantity: '1000000' });
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-');
      expect(buf.length).toBeGreaterThan(0);
    });
  });
});
