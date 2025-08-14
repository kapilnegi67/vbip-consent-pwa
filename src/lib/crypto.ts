import CryptoJS from 'crypto-js';

export async function computeSHA256(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
  const hash = CryptoJS.SHA256(wordArray);
  return hash.toString(CryptoJS.enc.Hex);
}

export async function computeMD5(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
  const hash = CryptoJS.MD5(wordArray);
  return hash.toString(CryptoJS.enc.Base64);
}

export function generateSecureId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}${timestamp}-${random}`;
}

export function createChunkId(sessionId: string, mediaId: string, index: number): string {
  return `${sessionId}:${mediaId}:${index}`;
}

export function maskAadhaar(aadhaar: string): string {
  if (aadhaar.length !== 12) {
    throw new Error('Invalid Aadhaar number length');
  }
  return `XXXX-XXXX-${aadhaar.slice(-4)}`;
}

export function generateIdempotencyKey(chunkId: string): string {
  return `upload-${chunkId}-${Date.now()}`;
}
