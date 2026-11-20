import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { lireConfig } from '../config.js';
import type { GithubService } from '../github/github.service.js';
import { VersionsService } from './versions.service.js';

const config = lireConfig({ GITHUB_PROPRIETAIRE: 'proprio', GITHUB_CLIENT_ID: 'Iv', GITHUB_CLIENT_SECRET: 's', SESSION_SECRET: 'x'.repeat(32) });
const CORPS = '### Features\n\n* Page d\'accueil ([#3](u)) ([c4a7c4c](u)), closes [#1](u)\n';

describe('VersionsService', () => {
  const gh = {
    repos: { getLatestRelease: vi.fn() },
    pulls: { list: vi.fn(), listFiles: vi.fn(), merge: vi.fn() },
  };
  let service: VersionsService;

  const prVersion = { number: 4, title: 'chore(main): release 0.2.0', body: CORPS, html_url: 'https://github.com/proprio/poc/pull/4', head: { ref: 'release-please--branches--main' } };

  beforeEach(() => {
    vi.clearAllMocks();
    gh.repos.getLatestRelease.mockRejectedValue({ status: 404 });
    gh.pulls.list.mockResolvedValue({ data: [{ number: 6, head: { ref: 'chore/noms' } }, prVersion] });
    gh.pulls.listFiles.mockResolvedValue({ data: [{ filename: 'CHANGELOG.md' }, { filename: 'version.txt' }, { filename: '.release-please-manifest.json' }] });
    service = new VersionsService(config, { client: () => gh } as unknown as GithubService);
  });

  it('montre la version proposée avec son récapitulatif, et qu’aucune n’est encore publiée', async () => {
    const versions = await service.lire('jeton', 'poc');
    expect(versions.actuelle).toBeNull();
    expect(versions.proposee).toMatchObject({
      version: '0.2.0',
      numeroPr: 4,
      nouveautes: [{ texte: 'Page d\'accueil', demande: 1 }],
      publiable: true,
    });
  });

  it('montre la version actuelle quand elle existe', async () => {
    gh.repos.getLatestRelease.mockResolvedValue({ data: { tag_name: 'v0.1.0', html_url: 'https://github.com/proprio/poc/releases/tag/v0.1.0', published_at: '2026-11-16T10:00:00Z' } });
    gh.pulls.list.mockResolvedValue({ data: [] });
    expect(await service.lire('jeton', 'poc')).toEqual({
      actuelle: { version: '0.1.0', url: 'https://github.com/proprio/poc/releases/tag/v0.1.0', le: '2026-11-16T10:00:00Z' },
      proposee: null,
    });
  });

  it('publie en fusionnant la PR de version', async () => {
    await service.publier('jeton', 'poc');
    expect(gh.pulls.merge).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 4, merge_method: 'squash', commit_title: 'chore(main): release 0.2.0 (#4)' }),
    );
  });

  it('refuse de publier une PR de version qui touche du code', async () => {
    gh.pulls.listFiles.mockResolvedValue({ data: [{ filename: 'CHANGELOG.md' }, { filename: 'api/src/main.ts' }] });
    await expect(service.publier('jeton', 'poc')).rejects.toThrow(/api\/src\/main\.ts/);
    expect(gh.pulls.merge).not.toHaveBeenCalled();
  });

  it('refuse quand il n’y a rien à publier', async () => {
    gh.pulls.list.mockResolvedValue({ data: [] });
    await expect(service.publier('jeton', 'poc')).rejects.toBeInstanceOf(ConflictException);
  });
});
