import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { AgentService } from '../agent/agent.service.js';
import { ApercuService } from '../apercu/apercu.service.js';
import { CONFIG, type Config } from '../config.js';
import { traduireErreurGithub } from '../github/erreurs.js';
import { GithubService } from '../github/github.service.js';
import { DemoService } from '../demo/demo.service.js';
import { ProjetsService } from '../projets/projets.service.js';
import { StoriesService } from '../stories/stories.service.js';
import { numeroDepuisUrl, peutFusionner, type Verification } from './verification.js';
import { lireControles, relancerControles } from './controles-github.js';
import { lireIdentifiant } from '../projets/depot.js';
import { brancheDe } from '../agent/agent.js';

export const RAISON_BRANCHE_MODIFIEE =
  'Des modifications ont été ajoutées à la branche en dehors d’ADA : ce n’est plus ce que vous avez vérifié dans l’aperçu. Un développeur doit les relire ; si elles sont voulues, la fusion se fait sur GitHub.';

@Injectable()
export class VerificationService {
  private readonly log = new Logger(VerificationService.name);

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly github: GithubService,
    private readonly agent: AgentService,
    private readonly stories: StoriesService,
    private readonly apercu: ApercuService,
    private readonly projets: ProjetsService,
    private readonly demo: DemoService,
  ) {}

  /** Nombre de commits de main absents de la branche (0 : la branche est à jour). */
  private async retard(gh: ReturnType<GithubService['client']>, depot: string, base: string, tete: string): Promise<number> {
    const { data } = await gh.repos.compareCommits({ ...lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE), base: tete, head: base });
    return data.ahead_by;
  }

  /**
   * Numéro de la pull request de la demande. L'activité locale la mentionne, mais ce fichier peut
   * manquer (dossier d'aperçus perdu, serveur remplacé) : GitHub reste la source de vérité, et la
   * PR s'y retrouve par sa branche. Sans cela, la demande resterait « à vérifier » sans PR et
   * bloquerait tout le projet.
   */
  private async numeroPullRequest(gh: ReturnType<GithubService['client']>, jeton: string, depot: string, numero: number, urlConnue: string | null): Promise<number | null> {
    const connu = numeroDepuisUrl(urlConnue);
    if (connu) return connu;
    try {
      const detail = await this.stories.detail(jeton, depot, numero);
      const { owner, repo } = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
      const { data } = await gh.pulls.list({ owner, repo, head: `${owner}:${brancheDe({ numero, titre: detail.titre, type: detail.type })}`, state: 'all', per_page: 5 });
      return data[0]?.number ?? null;
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  /** La PR de la demande, l'état de ses contrôles, et si le PO peut fusionner. */
  async verifier(jeton: string, depot: string, numero: number): Promise<Verification> {
    const activite = await this.agent.activite(depot, numero);
    const numeroPr = await this.numeroPullRequest(this.github.client(jeton), jeton, depot, numero, activite.pullRequest);
    if (!numeroPr) return { pullRequest: null, controles: [], fusionnable: false, raison: 'Aucune pull request pour cette demande' };
    const gh = this.github.client(jeton);
    const { owner, repo } = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
    try {
      const { data: pr } = await gh.pulls.get({ owner, repo, pull_number: numeroPr });
      const etat = pr.merged ? 'fusionnee' : pr.state === 'closed' ? 'fermee' : 'ouverte';
      // Les contrôles que GitHub exige vraiment (règle de protection) ; à défaut, ceux d'ada.json.
      const controlesRequis = (await this.projets.controlesExiges(gh, owner, repo, pr.base.ref)) ?? (await this.projets.lireConfigDepot(gh, owner, repo, pr.base.ref)).controlesRequis;
      const controles = await lireControles(gh, owner, repo, pr.head.sha, controlesRequis);
      // La branche doit être exactement ce qu'ADA a poussé et que le PO a vu dans l'aperçu : quelqu'un
      // qui y ajoute un commit sur GitHub n'est pas passé par ADA, et sa CI verte ne dit rien de ce qu'il a écrit.
      const horsAda = etat === 'ouverte' && activite.tete && pr.head.sha !== activite.tete;
      return {
        pullRequest: { numero: pr.number, url: pr.html_url, etat },
        controles,
        ...(horsAda ? { fusionnable: false, raison: RAISON_BRANCHE_MODIFIEE } : peutFusionner(etat, pr.mergeable, controles, pr.title)),
      };
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  /** Relance les contrôles que GitHub n'a pas lancés (ou en échec), une fois la cause réglée. */
  async relancerControles(jeton: string, depot: string, numero: number): Promise<Verification> {
    const gh = this.github.client(jeton);
    const numeroPr = await this.numeroPullRequest(gh, jeton, depot, numero, (await this.agent.activite(depot, numero)).pullRequest);
    if (!numeroPr) throw new ConflictException('Aucune pull request pour cette demande');
    const { owner, repo } = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
    try {
      const { data: pr } = await gh.pulls.get({ owner, repo, pull_number: numeroPr });
      await relancerControles(gh, owner, repo, pr.head.sha);
    } catch (e) {
      traduireErreurGithub(e);
    }
    return this.verifier(jeton, depot, numero);
  }

  /**
   * Fusion par le PO (en son nom), seulement si tout est vert. Squash : un seul commit
   * Conventional Commits sur main (release-please), qui ferme l'issue.
   */
  async fusionner(jeton: string, depot: string, numero: number): Promise<Verification> {
    const verification = await this.verifier(jeton, depot, numero);
    if (!verification.fusionnable || !verification.pullRequest) {
      throw new ConflictException(verification.raison ?? 'Fusion impossible pour l’instant');
    }
    const gh = this.github.client(jeton);
    const { owner, repo } = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
    try {
      const { data: pr } = await gh.pulls.get({ owner, repo, pull_number: verification.pullRequest.numero });
      // Branche en retard sur main : on la met à jour d'abord ; les contrôles repartent sur le code
      // réellement fusionné, et le PO valide de nouveau quand ils sont verts.
      if ((await this.retard(gh, depot, pr.base.ref, pr.head.sha)) > 0) {
        await gh.pulls.updateBranch({ owner, repo, pull_number: pr.number, expected_head_sha: pr.head.sha });
        // La mise à jour vient d'ADA : le nouveau bout de la branche est le sien, pas celui d'un tiers.
        const { data: branche } = await gh.repos.getBranch({ owner, repo, branch: pr.head.ref }).catch(() => ({ data: null }));
        await this.agent.noterTete(depot, numero, branche?.commit.sha ?? null);
        return {
          ...verification,
          fusionnable: false,
          raison:
            'Le projet a évolué depuis cette demande : elle vient d’être mise à jour et les contrôles sont relancés. Revenez valider quand ils sont verts.',
        };
      }
      await gh.pulls.merge({
        owner,
        repo,
        pull_number: pr.number,
        // Le commit exact que les contrôles ont vérifié : un push arrivé entre-temps fait refuser la fusion.
        sha: pr.head.sha,
        merge_method: 'squash',
        commit_title: `${pr.title} (#${pr.number})`,
        commit_message: `Closes #${numero}`,
      });
    } catch (e) {
      traduireErreurGithub(e);
    }
    // La fusion est faite : la suite (ménage) ne doit jamais faire échouer la réponse au PO.
    await this.apresFusion(jeton, depot, numero);
    return this.verifier(jeton, depot, numero);
  }

  /**
   * « Closes #n » ferme l'issue en même temps que la fusion : on ne la ferme que si elle est
   * encore ouverte, puis on retire le statut et on remet l'aperçu sur main. Chaque étape est
   * indépendante : un échec est journalisé, sans annuler ni masquer la fusion.
   */
  private async apresFusion(jeton: string, depot: string, numero: number): Promise<void> {
    const gh = this.github.client(jeton);
    const { owner, repo } = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
    const etapes: [string, () => Promise<unknown>][] = [
      [
        'fermeture de l’issue',
        async () => {
          const { data: issue } = await gh.issues.get({ owner, repo, issue_number: numero });
          if (issue.state === 'open') {
            await gh.issues.update({ owner, repo, issue_number: numero, state: 'closed', state_reason: 'completed' });
          }
        },
      ],
      ['retrait du statut', () => this.stories.retirerStatut(jeton, depot, numero)],
      ['demande parent (découpage) mise à jour', () => this.stories.signalerLivraisonAuParent(jeton, depot, numero)],
      ['retour de l’aperçu sur main', () => this.apercu.revenirSurMain(jeton, depot)],
      ['relance de l’application de l’aperçu', () => this.apercu.relancerApplication(depot)],
      ['mise à jour du lien de démonstration', () => this.demo.mettreAJour(jeton, depot)],
    ];
    for (const [etape, action] of etapes) {
      try {
        await action();
      } catch (e) {
        this.log.warn(`Après fusion de ${depot}#${numero}, ${etape} : ${(e as Error).message.split('\n')[0]}`);
      }
    }
  }
}
