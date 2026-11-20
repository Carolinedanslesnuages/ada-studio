import { describe, it, expect } from 'vitest';
import { lireConfig, loginAutorise } from './config.js';

const base = {
  GITHUB_PROPRIETAIRE: 'Proprio',
  GITHUB_CLIENT_ID: 'Iv-test',
  GITHUB_CLIENT_SECRET: 'secret',
  SESSION_SECRET: 'x'.repeat(32),
};

describe('Configuration', () => {
  it('refuse de démarrer sans les identifiants de la GitHub App', () => {
    expect(() => lireConfig({ GITHUB_PROPRIETAIRE: 'p' })).toThrow(/GITHUB_CLIENT_ID/);
  });

  it('n’autorise par défaut que le propriétaire (compte personnel)', () => {
    const config = lireConfig(base);
    expect(loginAutorise(config, 'proprio')).toBe(true);
    expect(loginAutorise(config, 'inconnu')).toBe(false);
  });

  it('autorise exactement la liste fournie, sans tenir compte de la casse', () => {
    const config = lireConfig({ ...base, LOGINS_AUTORISES: 'po-un, PO-Deux' });
    expect(loginAutorise(config, 'po-deux')).toBe(true);
    expect(loginAutorise(config, 'proprio')).toBe(false);
  });
});
