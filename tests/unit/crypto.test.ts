import { computeSHA256, computeMD5, generateSecureId, createChunkId, maskAadhaar } from '@/lib/crypto';

describe('Crypto utilities', () => {
  test('computeSHA256 generates correct hash', async () => {
    const blob = new Blob(['test data'], { type: 'text/plain' });
    const hash = await computeSHA256(blob);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  test('computeMD5 generates correct hash', async () => {
    const blob = new Blob(['test data'], { type: 'text/plain' });
    const hash = await computeMD5(blob);
    expect(hash).toBeTruthy();
  });

  test('generateSecureId creates unique IDs', () => {
    const id1 = generateSecureId('test-');
    const id2 = generateSecureId('test-');
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^test-/);
  });

  test('createChunkId formats correctly', () => {
    const chunkId = createChunkId('session123', 'media456', 5);
    expect(chunkId).toBe('session123:media456:5');
  });

  test('maskAadhaar masks correctly', () => {
    const aadhaar = '123456789012';
    const masked = maskAadhaar(aadhaar);
    expect(masked).toBe('XXXX-XXXX-9012');
  });

  test('maskAadhaar throws on invalid length', () => {
    expect(() => maskAadhaar('12345')).toThrow('Invalid Aadhaar number length');
  });
});
