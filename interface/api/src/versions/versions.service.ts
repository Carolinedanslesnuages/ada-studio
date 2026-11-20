import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { CONFIG, type Config } from '../config.js';
import { traduireErreurGithub } from '../github/erreurs.js';
import { GithubService } from '../github/github.service.js';
import { lireRecapitulatif, peutPublier, PREFIXE_BRANCHE_VERSION, type Recapitulatif } from './versions.js';
import { lireIdentifiant, type CibleDepot } from '../projets/depot.js';

export interface Versions {
  actuelle: { version: string; url: string; le: string | null } | null;
  proposee: (Recapitulatif & { numeroPr: number; url: string; publiable: boolean; raison: string | null }) | null;
}

@Injectable()
export class VersionsService {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly github: GithubService,
  ) {}

  /** Compte et dépôt GitHub d'un projet d'ADA (voir projets/depot.ts). */
  private cible(depot: string): CibleDepot {
    return lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
  }

  async lire(jeton: string, depot: string): Promise<Versions> {
    const gh = this.github.client(jeton);
    try {
      const actuelle = await gh.repos
        .getLatestRelease({ ...this.cible(depot) })
        .then(({ data }) => ({ version: data.tag_name.replace(/^v/, ''), url: data.html_url, le: data.published_at ?? null }))
        .catch((e: unknown) => {
          if ((e as { status?: number }).status === 404) return null; // aucune version publiée
          throw e;
        });
      const { data: ouvertes } = await gh.pulls.list({ ...this.cible(depot), state: 'open', per_page: 50 });
      const pr = ouvertes.find((p) => p.head.ref.startsWith(PREFIXE_BRANCHE_VERSION));
      if (!pr) return { actuelle, proposee: null };
      const { data: fichiers } = await gh.pulls.listFiles({ ...this.cible(depot), pull_number: pr.number });
      return {
        actuelle,
        proposee: {
          ...lireRecapitulatif(pr.title, pr.body ?? ''),
          numeroPr: pr.number,
          url: pr.html_url,
          ...peutPublier(fichiers.map((f) => f.filename)),
        },
      };
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  /** Fusionne la PR de version ; release-please crée ensuite le tag et la page de version. */
  async publier(jeton: string, depot: string): Promise<Versions> {
    const versions = await this.lire(jeton, depot);
    const proposee = versions.proposee;
    if (!proposee) throw new ConflictException('Aucune nouvelle version à publier');
    if (!proposee.publiable) throw new ConflictException(proposee.raison ?? 'Publication impossible');
    try {
      await this.github.client(jeton).pulls.merge({
        ...this.cible(depot),
        pull_number: proposee.numeroPr,
        merge_method: 'squash',
        commit_title: `chore(main): release ${proposee.version} (#${proposee.numeroPr})`,
      });
    } catch (e) {
      traduireErreurGithub(e);
    }
    return this.lire(jeton, depot);
  }
}
