import { describe, it, expect } from 'vitest';
import { GithubService } from './github.service.js';

describe('Client GitHub', () => {
  it('réessaie automatiquement les erreurs passagères (extension « retry »)', () => {
    const client = new GithubService().client('jeton') as unknown as { retry?: { retryRequest?: unknown } };
    expect(typeof client.retry?.retryRequest).toBe('function');
  });
});
