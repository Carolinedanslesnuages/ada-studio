/** Droit d'écrire d'un auteur dans un projet, demandé à GitHub et gardé quelques minutes (voir confiance.ts). */
import type { GithubService } from '../github/github.service.js';
import type { CibleDepot } from '../projets/depot.js';
import { droitEcriture, lienDeConfiance } from './confiance.js';

type ClientGithub = ReturnType<GithubService['client']>;

export class DroitsAuteur {
  constructor(private readonly cible: (depot: string) => CibleDepot) {}

  /** « dépôt|login » → droit d'écrire, gardé 5 minutes (un refus d'appel, 30 secondes). */
  private readonly droits = new Map<string, { ecrit: boolean; expire: number }>();

  /** Le compte peut-il écrire dans le projet ? Demandé à GitHub ; en cas d'erreur, non. */
  private async peutEcrire(gh: ClientGithub, depot: string, login: string): Promise<boolean> {
    const { owner, repo } = this.cible(depot);
    const cle = `${owner}/${repo}|${login.toLowerCase()}`;
    const connu = this.droits.get(cle);
    if (connu && connu.expire > Date.now()) return connu.ecrit;
    let ecrit = false;
    let duree = 5 * 60_000;
    try {
      const { data } = await gh.repos.getCollaboratorPermissionLevel({ owner, repo, username: login });
      ecrit = droitEcriture(data.role_name) || droitEcriture(data.permission);
    } catch {
      duree = 30_000;
    }
    this.droits.set(cle, { ecrit, expire: Date.now() + duree });
    return ecrit;
  }

  /** Auteur (issue ou commentaire) digne de confiance : propriétaire, ou membre/collaborateur qui a le droit d'écrire. */
  async fiable(gh: ClientGithub, depot: string, lien: string | null | undefined, login: string | null | undefined): Promise<boolean> {
    const confiance = lienDeConfiance(lien);
    if (confiance !== 'a-verifier') return confiance === 'cru';
    return login ? this.peutEcrire(gh, depot, login) : false;
  }
}
