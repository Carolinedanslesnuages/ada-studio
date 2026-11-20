import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { ConnecteGuard, MARGE_RENOUVELLEMENT_MS } from './connecte.guard.js';
import type { GithubOAuthService } from './github-oauth.service.js';

const contexte = (session: Record<string, unknown> | undefined) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ session }) }) }) as unknown as ExecutionContext;

const session = (extra: Record<string, unknown>) => ({
  jeton: 'ancien',
  destroy: vi.fn((fin: () => void) => fin()),
  ...extra,
});

describe('Garde de connexion et renouvellement du jeton', () => {
  const oauth = { rafraichir: vi.fn() };
  let garde: ConnecteGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    garde = new ConnecteGuard(oauth as unknown as GithubOAuthService);
  });

  it('refuse sans session GitHub', async () => {
    await expect(garde.canActivate(contexte(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('laisse passer un jeton encore valide, sans le renouveler', async () => {
    expect(await garde.canActivate(contexte(session({ jetonExpireLe: Date.now() + MARGE_RENOUVELLEMENT_MS + 3_600_000 })))).toBe(true);
    expect(oauth.rafraichir).not.toHaveBeenCalled();
  });

  it('renouvelle en silence un jeton qui expire bientôt', async () => {
    oauth.rafraichir.mockResolvedValue({ access_token: 'nouveau', refresh_token: 'renouv-2', expires_in: 28_800 });
    const sess = session({ jetonExpireLe: Date.now() + 60_000, jetonRafraichissement: 'renouv-1' });
    expect(await garde.canActivate(contexte(sess))).toBe(true);
    expect(oauth.rafraichir).toHaveBeenCalledWith('renouv-1');
    expect(sess.jeton).toBe('nouveau');
    expect((sess as Record<string, unknown>).jetonRafraichissement).toBe('renouv-2');
    expect((sess as Record<string, unknown>).jetonExpireLe as number).toBeGreaterThan(Date.now() + 28_000_000);
  });

  it('ferme la session et demande une reconnexion si le renouvellement échoue', async () => {
    oauth.rafraichir.mockRejectedValue(new UnauthorizedException('bad_refresh_token'));
    const sess = session({ jetonExpireLe: Date.now() - 1000, jetonRafraichissement: 'perime' });
    await expect(garde.canActivate(contexte(sess))).rejects.toThrow(/reconnectez-vous/);
    expect(sess.destroy).toHaveBeenCalled();
  });

  it('ferme une session expirée sans jeton de renouvellement', async () => {
    const sess = session({ jetonExpireLe: Date.now() - 1000 });
    await expect(garde.canActivate(contexte(sess))).rejects.toThrow(/reconnectez-vous/);
    expect(oauth.rafraichir).not.toHaveBeenCalled();
  });

  it('renouvelle assez tôt pour qu’une tâche lancée maintenant garde un jeton valide pendant au moins 2 heures', async () => {
    oauth.rafraichir.mockResolvedValue({ access_token: 'nouveau', refresh_token: 'renouv-2', expires_in: 28_800 });
    const sess = session({ jetonExpireLe: Date.now() + MARGE_RENOUVELLEMENT_MS - 60_000, jetonRafraichissement: 'renouv-1' });
    await garde.canActivate(contexte(sess));
    expect(oauth.rafraichir).toHaveBeenCalledTimes(1);
  });

  it('des requêtes simultanées partagent un seul renouvellement (l’ancien jeton de renouvellement ne sert qu’une fois)', async () => {
    let terminer: (valeur: { access_token: string; refresh_token: string; expires_in: number }) => void = () => undefined;
    oauth.rafraichir.mockImplementation(() => new Promise((ok) => (terminer = ok)));
    const proches = () => session({ jetonExpireLe: Date.now() + 1000, jetonRafraichissement: 'renouv-1' });
    const [a, b, c] = [proches(), proches(), proches()];
    const toutes = Promise.all([garde.canActivate(contexte(a)), garde.canActivate(contexte(b)), garde.canActivate(contexte(c))]);
    terminer({ access_token: 'nouveau', refresh_token: 'renouv-2', expires_in: 28_800 });
    expect(await toutes).toEqual([true, true, true]);
    expect(oauth.rafraichir).toHaveBeenCalledTimes(1);
    expect([a.jeton, b.jeton, c.jeton]).toEqual(['nouveau', 'nouveau', 'nouveau']);
  });
});
