import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { lireCombinaisons, raisonRefus, type Combinaisons } from '../variantes/combinaisons.js';
import type { Composants, Style } from '../ada/ada-config.js';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Octokit } from '@octokit/rest';
import { ApercuService, type Executer } from '../apercu/apercu.service.js';
import { CONFIG, type Config } from '../config.js';
import { decrireErreurGithub, traduireErreurGithub } from '../github/erreurs.js';
import { GithubService } from '../github/github.service.js';
import { lireAdaConfig, type AdaConfig } from '../ada/ada-config.js';
import { catalogue, FAMILLES, TYPES, type Modele } from './modeles.js';
import { validerProjet } from './projet.js';
import { creerDepotVide, enregistrerIdee, pousserModele } from './creation-depot.js';
import { identifiantProjet } from './depot.js';
import { ProtectionMain, type Protection } from './protection-main.js';
import { autoriserReleasePlease, imposerSquash, poserLabels } from './reglages-depot.js';
import { prReprise, TOPIC_REPRISE } from './reprise.js';

export { TOPIC_REPRISE } from './reprise.js';
export type { EtatProtection, Protection } from './protection-main.js';

export interface Projet {
  /** Identifiant dans ADA : « nom », ou « compte~nom » hors de l'organisation (voir depot.ts). */
  id: string;
  nom: string;
  proprietaire: string;
  /** Dépôt de l'organisation d'ADA, ou du compte personnel du PO. */
  compte: 'organisation' | 'personnel';
  /** Reprise pas encore validée (#37) : analyse en cours, ou PR de reprise à fusionner. */
  reprise: { pullRequest: string | null } | null;
  /** Projet repris (pas créé par ADA) : il peut être désynchronisé, sans rien supprimer. */
  repris: boolean;
  description: string | null;
  prive: boolean;
  url: string;
  misAJourLe: string | null;
}

/** Réglage GitHub fait automatiquement, ou à faire par le PO (avec le lien pour le faire). */
export interface Reglage {
  etat: 'fait' | 'a-faire';
  lien: string;
}

export interface ResultatCreation {
  projet: Projet;
  reglages: { versionsAutomatiques: Reglage; protectionMain: Reglage };
  /** Numéro de la demande créée à partir de l'idée du PO (l'assistant s'en saisit) ; null sans idée. */
  idee: number | null;
}

export type DepotGithub = {
  name: string;
  owner: { login: string };
  default_branch?: string;
  archived?: boolean;
  permissions?: { admin?: boolean; push?: boolean };
  description: string | null;
  private: boolean;
  html_url: string;
  updated_at?: string | null;
  topics?: string[];
};

export const versProjet = (d: DepotGithub, proprietaireParDefaut: string): Projet => ({
  id: identifiantProjet(d.owner.login, d.name, proprietaireParDefaut),
  nom: d.name,
  proprietaire: d.owner.login,
  compte: d.owner.login.toLowerCase() === proprietaireParDefaut.toLowerCase() ? 'organisation' : 'personnel',
  reprise: null,
  repris: (d.topics ?? []).includes(TOPIC_REPRISE),
  description: d.description,
  prive: d.private,
  url: d.html_url,
  misAJourLe: d.updated_at ?? null,
});

/** Topic posé le temps de la création : permet de reprendre une création interrompue. */
const TOPIC_CREATION = 'ada-studio-creation';
const execFileAsync = promisify(execFile);
const executerParDefaut: Executer = (commande, args, options) =>
  execFileAsync(commande, args, { ...options, maxBuffer: 10 * 1024 * 1024 });
const statut = (e: unknown) => (e as { status?: number }).status;


@Injectable()
export class ProjetsService {
  private readonly journal = new Logger(ProjetsService.name);
  executer: Executer = executerParDefaut;

  private readonly protection: ProtectionMain;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly github: GithubService,
    private readonly apercu: ApercuService,
  ) {
    this.protection = new ProtectionMain(config, github, (gh, owner, repo, ref) => this.lireConfigDepot(gh, owner, repo, ref), this.journal);
  }

  /** Topic des projets d'ADA studio. */
  private get topics(): string[] {
    return [this.config.TOPIC_ATELIER];
  }

  private get proprietaire(): string {
    return this.config.GITHUB_PROPRIETAIRE;
  }

  /** Dossier `catalogue/` d'ADA : un sous-dossier par modèle (même chemin depuis src/ et dist/). */
  get dossierCatalogue(): string {
    return this.config.CATALOGUE
      ? resolve(this.config.CATALOGUE)
      : resolve(import.meta.dirname, '..', '..', '..', '..', 'catalogue');
  }

  /** Dossier `skills/po/` d'ADA : les skills livrées dans chaque projet créé. */
  get dossierSkillsPo(): string {
    return this.config.SKILLS_PO
      ? resolve(this.config.SKILLS_PO)
      : resolve(import.meta.dirname, '..', '..', '..', '..', 'skills', 'po');
  }

  /** Catalogue : un modèle n'est proposé que si son dossier est livré avec son ada.json. */
  modeles(): { familles: typeof FAMILLES; types: typeof TYPES; modeles: Modele[]; combinaisons: Combinaisons } {
    const modeles = catalogue().map((modele) => {
      const config = this.configCatalogue(modele.id);
      return {
        ...modele,
        disponible: config !== null,
        deployable: Boolean(config?.deploiement),
        interface: config?.interface ? { variantes: config.interface.variantes } : null,
      };
    });
    return { familles: FAMILLES, types: TYPES, modeles, combinaisons: lireCombinaisons() };
  }

  /**
   * Style et bibliothèque d'un nouveau projet : imposés par le modèle sans front (aucun) ou sans
   * variantes (valeurs par défaut) ; sinon ceux choisis, si la combinaison est autorisée.
   */
  private apparenceCreation(modele: Modele, style: Style, composants: Composants): { style: Style; composants: Composants } | null {
    if (!modele.interface) return null;
    const { parDefaut } = lireCombinaisons();
    if (!modele.interface.variantes) {
      if (style !== parDefaut.style || composants !== parDefaut.composants) {
        throw new BadRequestException({ erreurs: { composants: 'Ce modèle n’existe qu’en CSS maison, sans bibliothèque de composants' } });
      }
      return parDefaut;
    }
    const raison = raisonRefus(style, composants);
    if (raison) throw new BadRequestException({ erreurs: { composants: raison } });
    return { style, composants };
  }

  /** ada.json d'un modèle du catalogue ; null si le modèle n'est pas livré (ou illisible). */
  configCatalogue(id: string): AdaConfig | null {
    const chemin = join(this.dossierCatalogue, id, 'ada.json');
    if (!existsSync(chemin)) return null;
    try {
      return lireAdaConfig(readFileSync(chemin, 'utf8'));
    } catch (e) {
      this.journal.warn(`Modèle ${id} écarté : ${(e as Error).message}`);
      return null;
    }
  }

  /** ada.json d'un dépôt (sur GitHub) ; absent → comportement Vue + NestJS. */
  async lireConfigDepot(gh: Octokit, owner: string, repo: string, ref?: string): Promise<AdaConfig> {
    try {
      const { data } = await gh.repos.getContent({ owner, repo, path: 'ada.json', ...(ref ? { ref } : {}) });
      if (Array.isArray(data) || !('content' in data)) return lireAdaConfig(null);
      return lireAdaConfig(Buffer.from(data.content, 'base64').toString('utf8'));
    } catch (e) {
      if (statut(e) === 404) return lireAdaConfig(null);
      throw e;
    }
  }

  /**
   * Dépôts que le PO peut voir dans l'organisation d'ADA et dans son compte personnel (lecture
   * directe, pas la recherche GitHub, dont l'index met plusieurs minutes à voir un dépôt neuf).
   * Le jeton de l'application ne voit que les dépôts où elle est installée.
   */
  async depotsAccessibles(gh: Octokit, login: string): Promise<DepotGithub[]> {
    const personnels = (await gh.paginate(gh.repos.listForAuthenticatedUser, { affiliation: 'owner', per_page: 100 })) as DepotGithub[];
    if (this.proprietaire.toLowerCase() === login.toLowerCase()) return personnels;
    const organisation = (await gh.paginate(gh.repos.listForOrg, { org: this.proprietaire, per_page: 100 })) as DepotGithub[];
    return [...organisation, ...personnels];
  }

  aLeTopic(depot: DepotGithub, ...topics: string[]): boolean {
    return (depot.topics ?? []).some((topic) => topics.includes(topic));
  }

  /**
   * Projets d'ADA : dépôts portant le topic de l'atelier, et reprises (#37). Une reprise est
   * visible dès son lancement, pour suivre l'analyse et valider la PR ; une fois sa PR fusionnée
   * (ada.json sur main), elle reçoit le topic définitif et devient un projet comme les autres.
   */
  async lister(jeton: string, login: string): Promise<Projet[]> {
    const gh = this.github.client(jeton);
    try {
      const depots = await this.depotsAccessibles(gh, login);
      const reprises = await Promise.all(
        depots
          .filter((d) => !this.aLeTopic(d, ...this.topics) && this.aLeTopic(d, TOPIC_REPRISE))
          .map(async (d) => {
            const projet = versProjet(d, this.proprietaire);
            if (await this.repriseFusionnee(gh, d)) return projet;
            return { ...projet, reprise: { pullRequest: await prReprise(gh, d.owner.login, d.name) } };
          }),
      );
      const parDate = new Map(depots.map((d) => [identifiantProjet(d.owner.login, d.name, this.proprietaire), d.updated_at ?? '']));
      return [...depots.filter((d) => this.aLeTopic(d, ...this.topics)).map((d) => versProjet(d, this.proprietaire)), ...reprises].sort((a, b) =>
        (parDate.get(b.id) ?? '').localeCompare(parDate.get(a.id) ?? ''),
      );
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  private async repriseFusionnee(gh: Octokit, depot: DepotGithub): Promise<boolean> {
    const owner = depot.owner.login;
    try {
      await gh.repos.getContent({ owner, repo: depot.name, path: 'ada.json', ref: depot.default_branch ?? 'main' });
    } catch (e) {
      if (statut(e) === 404) return false;
      throw e;
    }
    // Le marquage « reprise » est gardé : il distingue un projet repris d'un projet créé par ADA.
    const topics = [...(depot.topics ?? []), this.config.TOPIC_ATELIER];
    await gh.repos.replaceAllTopics({ owner, repo: depot.name, names: topics }).catch((e: unknown) => {
      this.journal.warn(`Topic de ${owner}/${depot.name} non mis à jour : ${decrireErreurGithub(e)}`);
    });
    return true;
  }

  /**
   * Création d'un projet depuis `catalogue/<modele>/` :
   * 1. dépôt privé vide (topic provisoire « ada-studio-creation », pour pouvoir reprendre) ;
   * 2. réglages avant le premier push (squash seul, release-please autorisé) ;
   * 3. copie du modèle personnalisée, poussée en un seul commit au nom du PO ;
   * 4. protection de main, topic définitif, labels.
   * Chaque étape est rejouable : une création interrompue est reprise avec le même nom.
   */
  async creer(jeton: string, login: string, donnees: unknown): Promise<ResultatCreation> {
    const validation = validerProjet(donnees);
    if (!validation.ok) throw new BadRequestException({ erreurs: validation.erreurs });
    const { projet, slug } = validation;
    const modele = this.modeles().modeles.find((m) => m.id === projet.modele);
    if (!modele?.disponible) throw new BadRequestException({ erreurs: { modele: 'Ce type de projet n’est pas encore disponible' } });
    const apparence = this.apparenceCreation(modele, projet.style, projet.composants);
    const dossierModele = join(this.dossierCatalogue, modele.id);
    const configModele = lireAdaConfig(await readFile(join(dossierModele, 'ada.json'), 'utf8'));
    const interfaceChoisie = apparence && configModele.interface ? { dossier: configModele.interface.dossier, ...apparence } : null;
    const gh = this.github.client(jeton);
    // Le projet appartient à la personne connectée : dépôt créé sur SON compte GitHub (avec son
    // jeton), jamais sur celui qui a configuré ADA. Les projets plus anciens restent où ils sont.
    const owner = login;
    const description = projet.objectif.slice(0, 350);

    // Un dépôt du même nom : si c'est une création d'ADA interrompue, on la reprend ; sinon le nom est pris.
    let existant: (DepotGithub & { template_repository?: { name?: string } | null }) | null = null;
    try {
      ({ data: existant } = await gh.repos.get({ owner, repo: slug }));
    } catch (e) {
      if (statut(e) !== 404) traduireErreurGithub(e);
    }
    const reprise = existant !== null && this.creationInterrompue(existant);
    if (existant && !reprise) {
      throw new ConflictException({ erreurs: { nom: `Un projet « ${slug} » existe déjà : choisissez un autre nom` } });
    }
    if (reprise) this.journal.log(`Reprise de la création interrompue de ${slug}`);

    let depot: DepotGithub;
    let versionsAutomatiques: Reglage['etat'];
    let protectionMain: Reglage['etat'];
    try {
      if (existant && reprise) {
        depot = existant;
        await gh.repos.update({ owner, repo: slug, description, private: projet.visibilite === 'prive' });
      } else {
        depot = await creerDepotVide(gh, slug, description, projet.visibilite === 'prive', (message) => this.journal.warn(message));
        await gh.repos.replaceAllTopics({ owner, repo: slug, names: [TOPIC_CREATION] });
      }
      // Réglages AVANT le premier push : ce push déclenche la CI et release-please.
      await imposerSquash(gh, owner, slug, (message) => this.journal.warn(message));
      versionsAutomatiques = await autoriserReleasePlease(gh, owner, slug, (message) => this.journal.warn(message));
      // Chart de déploiement : seulement si le PO prévoit de déployer le projet.
      const exclus = configModele.deploiement && !projet.deploye ? [configModele.deploiement.chart] : [];
      await pousserModele({ executer: this.executer, env: this.apercu.environnementGit(jeton), url: this.urlDepot(login, slug) }, login, dossierModele, configModele.personnaliser, exclus, {
        nom: projet.nom,
        baseline: projet.baseline,
        slug,
        objectif: projet.objectif,
        date: new Date().toISOString().slice(0, 10),
        po: login,
      }, this.dossierSkillsPo, interfaceChoisie);
      protectionMain = await this.protection.proteger(gh, owner, slug, configModele.controlesRequis);
      await gh.repos.replaceAllTopics({ owner, repo: slug, names: [this.config.TOPIC_ATELIER] });
      await this.poserLabels(gh, owner, slug);
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      traduireErreurGithub(e);
    }
    const idee = projet.idee ? await enregistrerIdee(gh, owner, slug, projet.idee, login, (message) => this.journal.warn(message)) : null;

    const base = `https://github.com/${owner}/${slug}/settings`;
    return {
      projet: versProjet({ ...depot, owner: { login: owner } }, this.proprietaire),
      reglages: {
        versionsAutomatiques: { etat: versionsAutomatiques, lien: `${base}/actions` },
        protectionMain: { etat: protectionMain, lien: `${base}/rules` },
      },
      idee,
    };
  }


  /**
   * Création d'ADA restée en chemin : topic provisoire, ou (ancienne méthode) dépôt généré depuis
   * un dépôt modèle « modele-… » sans le topic d'ADA.
   */
  private creationInterrompue(depot: DepotGithub & { template_repository?: { name?: string } | null }): boolean {
    const topics = depot.topics ?? [];
    if (topics.some((topic) => this.topics.includes(topic))) return false;
    return topics.includes(TOPIC_CREATION) || (depot.template_repository?.name ?? '').startsWith('modele-');
  }


  /** Adresse git du dépôt d'un projet (remplaçable en test par un dépôt local). */
  urlDepot = (owner: string, repo: string) => `https://github.com/${owner}/${repo}.git`;


  /**
   * Labels dont dépendent les formulaires d'issue (ils ne posent un label que s'il existe) et
   * les statuts de l'atelier. Un dépôt créé depuis un modèle n'hérite pas de ses labels.
   */
  poserLabels(gh: Octokit, owner: string, repo: string): Promise<void> {
    return poserLabels(gh, owner, repo);
  }

  /** Contrôles que GitHub exige réellement avant de fusionner sur cette branche (voir ProtectionMain). */
  controlesExiges(gh: Octokit, owner: string, repo: string, branche: string): Promise<string[] | null> {
    return this.protection.controlesExiges(gh, owner, repo, branche);
  }

  /** À l'ouverture d'un projet : sa branche principale doit être protégée (voir ProtectionMain). */
  assurerProtection(jeton: string, depot: string): Promise<Protection> {
    return this.protection.assurer(jeton, depot);
  }

  /** Le PO accepte qu'ADA protège la branche principale (projet repris). */
  protegerSurDemande(jeton: string, depot: string, login: string): Promise<Protection> {
    return this.protection.poserSurDemande(jeton, depot, login);
  }

  /** Le PO ne veut pas protéger la branche (projet repris) : ADA le retient et ne redemande pas. */
  refuserProtection(depot: string, login: string): Promise<Protection> {
    return this.protection.refuser(depot, login);
  }
}
