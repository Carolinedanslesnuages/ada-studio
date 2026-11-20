import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { estAutreEdition, MESSAGE_AUTRE_EDITION } from '../edition/edition.js';
import type { Octokit } from '@octokit/rest';
import { z } from 'zod';
import { CONFIG, type Config } from '../config.js';
import { decrireErreurGithub, traduireErreurGithub } from '../github/erreurs.js';
import { GithubService } from '../github/github.service.js';
import { identifiantProjet, lireIdentifiant, verifierAcces } from './depot.js';
import { ProjetsService, TOPIC_REPRISE, type DepotGithub } from './projets.service.js';
import { BRANCHE_REPRISE, CONTROLE_TITRE, prReprise, TITRE_REPRISE } from './reprise.js';
import { LABEL_LIBRE } from '../stories/story.js';
import { lireControles, relancerControles } from '../verification/controles-github.js';
import { numeroDepuisUrl, peutFusionner, type Controle, type Verification } from '../verification/verification.js';
import { StoriesService } from '../stories/stories.service.js';
import { AgentService } from '../agent/agent.service.js';

export interface DepotAReprendre {
  id: string;
  nom: string;
  proprietaire: string;
  compte: 'organisation' | 'personnel';
  description: string | null;
  url: string;
  /** PR de reprise déjà ouverte, en attente de validation par le PO. */
  repriseEnCours: string | null;
  /** L'assistant analyse le projet ; la PR de reprise s'ouvrira à la fin. */
  analyseEnCours: boolean;
}

/** État d'une reprise lancée : analyse, puis PR à valider (mêmes règles que pour une demande). */
export interface EtatReprise {
  analyseEnCours: boolean;
  pullRequest: Verification['pullRequest'];
  controles: Controle[];
  fusionnable: boolean;
  raison: string | null;
}

export interface ResultatReprise {
  /** Identifiant du projet dans ADA : il y apparaît dès le lancement de l'analyse. */
  id: string;
  /** Demande d'analyse (issue du projet), où l'assistant publie son bilan et ses améliorations. */
  analyse: string | null;
  /** PR de reprise, si elle était déjà ouverte. */
  pullRequest: string | null;
}

/** Début de la demande d'analyse enregistrée par une reprise : sert à la retrouver pour la fermer. */
export const DEBUT_DEMANDE_ANALYSE = 'Analyser ce projet comme s’il avait été créé avec ADA';

export type ResultatAnnulation = { etat: 'annulee' | 'desynchronisee' };

export function texteDemandeAnalyse(stack: string | null): string {
  return [
    `${DEBUT_DEMANDE_ANALYSE}, et proposer les améliorations pour qu’il en suive les règles (harnais et skills d’ADA).`,
    stack ? `Stack la plus proche : ${stack}.` : 'Stack : à déduire du projet.',
    'Apparence : celle du projet.',
  ].join('\n');
}

const schemaReprise = z.object({
  depot: z.string().min(1).max(141),
  /** Facultative : sans elle, l'analyse déduit comment démarrer l'aperçu. */
  modele: z.string().regex(/^[a-z0-9-]{1,60}$/).nullish(),
});
const statut = (e: unknown) => (e as { status?: number }).status;

@Injectable()
export class RepriseService {
  private readonly journal = new Logger(RepriseService.name);

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly github: GithubService,
    private readonly projets: ProjetsService,
    private readonly stories: StoriesService,
    private readonly agent: AgentService,
  ) {}

  /** Dépôts de l'organisation et du compte du PO qui ne sont pas encore dans ADA. */
  async lister(jeton: string, login: string): Promise<DepotAReprendre[]> {
    const gh = this.github.client(jeton);
    try {
      const depots = (await this.projets.depotsAccessibles(gh, login)).filter(
        (d) => !d.archived && d.permissions?.push !== false && !this.projets.aLeTopic(d, this.config.TOPIC_ATELIER, 'ada-studio-creation') && !estAutreEdition(d.topics, this.config.TOPIC_ATELIER),
      );
      const projets = new Set((await this.projets.lister(jeton, login)).map((projet) => projet.id));
      return Promise.all(
        depots
          .map((d) => ({ d, id: identifiantProjet(d.owner.login, d.name, this.config.GITHUB_PROPRIETAIRE) }))
          .filter(({ id }) => !projets.has(id))
          .sort((a, b) => a.d.name.localeCompare(b.d.name))
          .map(async ({ d, id }) => ({
            id,
            nom: d.name,
            proprietaire: d.owner.login,
            compte: d.owner.login.toLowerCase() === this.config.GITHUB_PROPRIETAIRE.toLowerCase() ? ('organisation' as const) : ('personnel' as const),
            description: d.description,
            url: d.html_url,
            ...(await this.etatReprise(gh, d, id)),
          })),
      );
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  private async etatReprise(gh: Octokit, depot: DepotGithub, id: string): Promise<Pick<DepotAReprendre, 'repriseEnCours' | 'analyseEnCours'>> {
    if (!this.projets.aLeTopic(depot, TOPIC_REPRISE)) return { repriseEnCours: null, analyseEnCours: false };
    const repriseEnCours = await prReprise(gh, depot.owner.login, depot.name);
    return { repriseEnCours, analyseEnCours: !repriseEnCours && (await this.agent.verrouActif(id)) !== null };
  }

  /**
   * Reprise : ADA marque le dépôt (topic provisoire, labels), enregistre la demande d'analyse
   * dans le projet au nom du PO et lance l'assistant. À la fin de son analyse, ADA ouvre la PR de
   * reprise (ada.json déduit) et l'assistant propose les améliorations. Rien n'arrive sur main
   * sans la fusion du PO. Une reprise déjà proposée renvoie sa PR.
   */
  async reprendre(jeton: string, login: string, donnees: unknown): Promise<ResultatReprise> {
    const saisie = schemaReprise.safeParse(donnees);
    if (!saisie.success) throw new BadRequestException('Choisissez le dépôt à reprendre');
    const id = saisie.data.depot.toLowerCase();
    const { owner, repo } = lireIdentifiant(id, this.config.GITHUB_PROPRIETAIRE);
    verifierAcces({ owner, repo }, login, this.config.GITHUB_PROPRIETAIRE);
    const modele = saisie.data.modele ? this.projets.modeles().modeles.find((m) => m.id === saisie.data.modele) : null;
    if (saisie.data.modele && !modele?.disponible) throw new BadRequestException('Cette stack n’est pas disponible');
    this.agent.verifierDisponible();
    const gh = this.github.client(jeton);

    let depot: DepotGithub;
    try {
      ({ data: depot } = await gh.repos.get({ owner, repo }));
    } catch (e) {
      traduireErreurGithub(e);
    }
    if (this.projets.aLeTopic(depot, this.config.TOPIC_ATELIER)) throw new ConflictException('Ce projet est déjà dans ADA studio');
    if (estAutreEdition(depot.topics, this.config.TOPIC_ATELIER)) throw new ConflictException(MESSAGE_AUTRE_EDITION);
    if (depot.archived) throw new BadRequestException('Ce dépôt est archivé : il ne peut pas être repris');
    if (depot.default_branch !== 'main') {
      throw new BadRequestException(`La branche principale de ce dépôt s’appelle « ${depot.default_branch} » : ADA travaille sur « main ». Un développeur doit la renommer avant la reprise.`);
    }
    if (await this.agent.verrouActif(id)) throw new ConflictException('ADA analyse déjà ce projet');

    try {
      const dejaOuverte = await prReprise(gh, owner, repo);
      if (dejaOuverte) return { id, analyse: null, pullRequest: dejaOuverte };

      await gh.repos
        .replaceAllTopics({ owner, repo, names: [...new Set([...(depot.topics ?? []), TOPIC_REPRISE])] })
        .catch((e: unknown) => {
          if (statut(e) === 403 || statut(e) === 404) {
            throw new ForbiddenException('Seul un administrateur de ce dépôt peut le faire reprendre par ADA.');
          }
          throw e;
        });
      await this.projets.poserLabels(gh, owner, repo);
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      this.journal.warn(`Reprise de ${owner}/${repo} : ${decrireErreurGithub(e)}`);
      traduireErreurGithub(e);
    }
    const demande = await this.stories.prompter(jeton, id, texteDemandeAnalyse(modele?.libelle ?? null), login);
    await this.agent.analyserReprise(jeton, id, demande.numero, login, { modele: modele?.id ?? null });
    return { id, analyse: `https://github.com/${owner}/${repo}/issues/${demande.numero}`, pullRequest: null };
  }

  async etat(jeton: string, depot: string): Promise<EtatReprise> {
    const { owner, repo } = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
    const gh = this.github.client(jeton);
    const analyseEnCours = (await this.agent.verrouActif(depot)) !== null;
    try {
      const numero = numeroDepuisUrl(await prReprise(gh, owner, repo));
      if (!numero) {
        return {
          analyseEnCours,
          pullRequest: null,
          controles: [],
          fusionnable: false,
          raison: analyseEnCours ? 'ADA analyse le projet' : 'L’analyse s’est arrêtée sans pull request de reprise',
        };
      }
      const { data: pr } = await gh.pulls.get({ owner, repo, pull_number: numero });
      const etat = pr.merged ? 'fusionnee' : pr.state === 'closed' ? 'fermee' : 'ouverte';
      const controles = await lireControles(gh, owner, repo, pr.head.sha, [CONTROLE_TITRE]);
      return { analyseEnCours, pullRequest: { numero: pr.number, url: pr.html_url, etat }, controles, ...peutFusionner(etat, pr.mergeable, controles, pr.title) };
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  /** Relance les contrôles de la PR de reprise (ex. après avoir réglé la facturation GitHub). */
  async relancerControles(jeton: string, depot: string): Promise<EtatReprise> {
    const { owner, repo } = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
    const gh = this.github.client(jeton);
    try {
      const numero = numeroDepuisUrl(await prReprise(gh, owner, repo));
      if (!numero) throw new ConflictException('Aucune pull request de reprise');
      const { data: pr } = await gh.pulls.get({ owner, repo, pull_number: numero });
      await relancerControles(gh, owner, repo, pr.head.sha);
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      traduireErreurGithub(e);
    }
    return this.etat(jeton, depot);
  }

  /**
   * Le PO valide la reprise depuis ADA (contrôles verts) : fusion en squash, puis le projet reçoit
   * le topic d'ADA et devient un projet comme les autres.
   */
  async fusionner(jeton: string, depot: string): Promise<EtatReprise> {
    const etat = await this.etat(jeton, depot);
    if (!etat.fusionnable || !etat.pullRequest) throw new ConflictException(etat.raison ?? 'Fusion impossible pour l’instant');
    const { owner, repo } = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
    const gh = this.github.client(jeton);
    try {
      await gh.pulls.merge({ owner, repo, pull_number: etat.pullRequest.numero, merge_method: 'squash', commit_title: `${TITRE_REPRISE} (#${etat.pullRequest.numero})` });
      const { data } = await gh.repos.get({ owner, repo });
      // Le marquage « reprise » est gardé : il distingue un projet repris d'un projet créé par ADA.
      const topics = [...(data.topics ?? []), this.config.TOPIC_ATELIER];
      await gh.repos.replaceAllTopics({ owner, repo, names: [...new Set(topics)] });
    } catch (e) {
      traduireErreurGithub(e);
    }
    return { ...etat, pullRequest: { ...etat.pullRequest, etat: 'fusionnee' }, fusionnable: false, raison: 'Déjà fusionnée' };
  }

  /**
   * Annule une reprise, ou désynchronise un projet repris. Rien n'est supprimé, ni dépôt ni demande.
   * - Reprise pas encore validée : la PR de reprise est fermée et sa branche retirée (main n'a
   *   jamais été modifié), la demande d'analyse est fermée avec une explication, le marquage est retiré.
   * - Reprise validée, ou projet créé par ADA : seul le marquage d'ADA est retiré ; fichiers,
   *   stories et versions restent. Le projet peut revenir par « Reprendre un projet ».
   */
  async annuler(jeton: string, login: string, depot: string): Promise<ResultatAnnulation> {
    const { owner, repo } = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
    if (await this.agent.verrouActif(depot)) throw new ConflictException('ADA travaille sur ce projet : attendez qu’elle ait terminé.');
    const gh = this.github.client(jeton);
    try {
      const { data } = await gh.repos.get({ owner, repo });
      const topics = data.topics ?? [];
      const autres = topics.filter((topic) => ![TOPIC_REPRISE, this.config.TOPIC_ATELIER].includes(topic));
      // Projet dans ADA (créé par elle, ou repris et validé) : seul son marquage est retiré.
      if (topics.includes(this.config.TOPIC_ATELIER)) {
        await gh.repos.replaceAllTopics({ owner, repo, names: autres });
        return { etat: 'desynchronisee' };
      }
      if (!topics.includes(TOPIC_REPRISE)) throw new BadRequestException('Ce projet n’est pas dans ADA.');
      const numeroPr = numeroDepuisUrl(await prReprise(gh, owner, repo));
      if (numeroPr) {
        await gh.issues.createComment({ owner, repo, issue_number: numeroPr, body: `Reprise annulée depuis ADA par ${login} : rien n'a été ajouté au projet.` });
        await gh.pulls.update({ owner, repo, pull_number: numeroPr, state: 'closed' });
      }
      await gh.git.deleteRef({ owner, repo, ref: `heads/${BRANCHE_REPRISE}` }).catch((e: unknown) => {
        if (statut(e) !== 404 && statut(e) !== 422) throw e; // branche déjà absente
      });
      const ouvertes = (await gh.paginate(gh.issues.listForRepo, { owner, repo, state: 'open', labels: LABEL_LIBRE, per_page: 100 })) as { number: number; body?: string | null }[];
      for (const demande of ouvertes.filter((issue) => (issue.body ?? '').includes(DEBUT_DEMANDE_ANALYSE))) {
        await gh.issues.createComment({ owner, repo, issue_number: demande.number, body: `Reprise annulée depuis ADA par ${login} : cette analyse est close.` });
        await gh.issues.update({ owner, repo, issue_number: demande.number, state: 'closed', state_reason: 'not_planned' });
      }
      await gh.repos.replaceAllTopics({ owner, repo, names: autres });
      return { etat: 'annulee' };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      traduireErreurGithub(e);
    }
  }

  /** Tant que la reprise n'est pas fusionnée, aucune demande ne se lance (ada.json pas encore sur main). */
  async verifierRepriseTerminee(jeton: string, depot: string): Promise<void> {
    const { owner, repo } = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
    const gh = this.github.client(jeton);
    let topics: string[] = [];
    try {
      ({ data: { topics = [] } } = await gh.repos.get({ owner, repo }));
    } catch (e) {
      traduireErreurGithub(e);
    }
    if (topics.includes(this.config.TOPIC_ATELIER) || !topics.includes(TOPIC_REPRISE)) return;
    try {
      await gh.repos.getContent({ owner, repo, path: 'ada.json', ref: 'main' });
    } catch (e) {
      if (statut(e) !== 404) traduireErreurGithub(e);
      throw new ConflictException('Validez d’abord la reprise du projet (bouton « Valider et fusionner la reprise ») : ADA saura alors démarrer son aperçu.');
    }
  }
}
