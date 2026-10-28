import crypto from 'crypto';
import { verifyGithubSignature } from '../services/github/github-webhook-signature';

describe('verifyGithubSignature', () => {
  const secret = 'topsecret';
  const body = Buffer.from(JSON.stringify({ zen: 'hi' }));
  const sig = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

  it('accepts a valid signature', () => {
    expect(verifyGithubSignature(body, sig, secret)).toBe(true);
  });

  it('rejects tampered bodies, wrong secrets and malformed headers', () => {
    expect(verifyGithubSignature(Buffer.from('{}'), sig, secret)).toBe(false);
    expect(verifyGithubSignature(body, sig, 'other')).toBe(false);
    expect(verifyGithubSignature(body, undefined, secret)).toBe(false);
    expect(verifyGithubSignature(body, 'sha1=abc', secret)).toBe(false);
    expect(verifyGithubSignature(body, 'sha256=zz', secret)).toBe(false);
    expect(verifyGithubSignature(body, sig, undefined)).toBe(false);
  });
});
