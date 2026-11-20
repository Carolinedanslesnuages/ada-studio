import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException, type ExecutionContext } from '@nestjs/common';
import { lireConfig } from '../config.js';
import type { GithubService } from '../github/github.service.js';
import { DUREE_ACCES_MS, ProjetGuard } from './projet.guard.js';

const config = lireConfig({ GITHUB_PROPRIETAIRE: 'proprio', GITHUB_CLIENT_ID: 'Iv', GITHUB_CLIENT_SECRET: 's', SESSION_SECRET: 'x'.repeat(32) });
const contexte = (depot: string, login = 'un-po') =>
  ({ switchToHttp: () => ({ getRequest: () => ({ params: { depot }, session: { jeton: 'jeton-du-po', utilisateur: { login } } }) }) }) as unknown as ExecutionContext;

describe('ProjetGuard (#37) : le compte du projet, puis les droits GitHub du PO', () => {
  const repos = { get: vi.fn() };
  let garde: ProjetGuard;

  beforeEach(() => {
    vi.useRealTimers();
    repos.get.mockReset();
    repos.get.mockResolvedValue({ data: {} });
    garde = new ProjetGuard(config, { client: () => ({ repos }) } as unknown as GithubService);
  });

  it('laisse passer les projets de l’organisation et du compte du PO que GitHub lui montre', async () => {
    expect(await garde.canActivate(contexte('pret-de-materiel'))).toBe(true);
    expect(await garde.canActivate(contexte('un-po~mon-poc'))).toBe(true);
    expect(repos.get).toHaveBeenCalledWith({ owner: 'proprio', repo: 'pret-de-materiel' });
    expect(repos.get).toHaveBeenCalledWith({ owner: 'un-po', repo: 'mon-poc' });
  });

  it('refuse le projet du compte d’un autre PO, et un identifiant mal formé, sans interroger GitHub', async () => {
    await expect(garde.canActivate(contexte('autre-po~son-poc'))).rejects.toThrow(ForbiddenException);
    await expect(garde.canActivate(contexte('../etc'))).rejects.toThrow(BadRequestException);
    expect(repos.get).not.toHaveBeenCalled();
  });

  it('refuse un dépôt de l’organisation que GitHub ne montre pas à ce PO (dépôt privé sans accès)', async () => {
    repos.get.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    await expect(garde.canActivate(contexte('depot-prive'))).rejects.toThrow(NotFoundException);
  });

  it('ne garde pas un refus : l’accès accordé ensuite passe', async () => {
    repos.get.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }));
    await expect(garde.canActivate(contexte('depot-prive'))).rejects.toThrow(ForbiddenException);
    expect(await garde.canActivate(contexte('depot-prive'))).toBe(true);
  });

  it('ne redemande pas GitHub à chaque requête du suivi (toutes les 4 s), mais revérifie après une minute', async () => {
    vi.useFakeTimers();
    await garde.canActivate(contexte('poc'));
    await garde.canActivate(contexte('poc'));
    expect(repos.get).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(DUREE_ACCES_MS + 1);
    await garde.canActivate(contexte('poc'));
    expect(repos.get).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('un accès accordé à un PO ne vaut pas pour un autre', async () => {
    await garde.canActivate(contexte('poc', 'un-po'));
    repos.get.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    await expect(garde.canActivate(contexte('poc', 'autre-po'))).rejects.toThrow(NotFoundException);
  });
});
