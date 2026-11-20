/**
 * Protection de la branche principale d'un projet : un changement n'y entre que par une PR,
 * contrôles verts. Projet créé par ADA : elle pose la règle elle-même ; projet repris : elle la
 * propose et le PO décide (son choix est retenu hors de GitHub).
 */
import type { Logger } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Octokit } from '@octokit/rest';
import type { AdaConfig } from '../ada/ada-config.js';
import type { Config } from '../config.js';
import { decrireErreurGithub, traduireErreurGithub } from '../github/erreurs.js';
import type { GithubService } from '../github/github.service.js';
import { lireIdentifiant } from './depot.js';
import { TOPIC_REPRISE } from './reprise.js';

const NOM_REGLE_MAIN = 'main protégée';
const statut = (e: unknown) => (e as { status?: number }).status;

/**
 * Protection de la branche principale d'un projet. « protegee » : une règle l'exige déjà (PR et
 * contrôles) ; « posee » : ADA vient de la poser ; « impossible » : GitHub refuse (raison dite au
 * PO) ; « a-proposer » : projet repris sans règle, ADA demande au PO s'il veut la protéger (cela
 * change la façon de travailler de son équipe) ; « refusee » : le PO a répondu non.
 */
export type EtatProtection = 'protegee' | 'posee' | 'impossible' | 'a-proposer' | 'refusee';
export interface Protection {
  etat: EtatProtection;
  raison: string | null;
  lien: string;
}

/** Règles en vigueur sur une branche (rulesets), telles que GitHub les applique. */
type RegleBranche = { type: string; parameters?: { required_status_checks?: { context: string }[] } };

export class ProtectionMain {
  constructor(
    private readonly config: Config,
    private readonly github: GithubService,
    /** ada.json du dépôt sur une branche : ses contrôles exigés servent quand ADA pose la règle. */
    private readonly lireConfigDepot: (gh: Octokit, owner: string, repo: string, ref?: string) => Promise<AdaConfig>,
    private readonly journal: Logger,
  ) {}

  /** Ruleset sur main : PR obligatoire, CI verte, ni suppression ni force push. Renvoie le refus de GitHub, s'il y en a un. */
  private async poserRegle(gh: Octokit, owner: string, repo: string, controlesRequis: string[]): Promise<{ ok: true } | { ok: false; statut?: number; message: string }> {
    try {
      // Reprise d'une création : la règle peut déjà exister.
      const { data: existantes } = await gh.request('GET /repos/{owner}/{repo}/rulesets', { owner, repo });
      if ((existantes ?? []).some((regle: { name?: string }) => regle.name === NOM_REGLE_MAIN)) return { ok: true };
      await gh.request('POST /repos/{owner}/{repo}/rulesets', {
        owner,
        repo,
        name: NOM_REGLE_MAIN,
        target: 'branch',
        enforcement: 'active',
        conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
        rules: [
          { type: 'deletion' },
          { type: 'non_fast_forward' },
          {
            type: 'pull_request',
            parameters: {
              required_approving_review_count: 0,
              dismiss_stale_reviews_on_push: false,
              require_code_owner_review: false,
              require_last_push_approval: false,
              required_review_thread_resolution: false,
            },
          },
          {
            type: 'required_status_checks',
            parameters: {
              strict_required_status_checks_policy: false,
              required_status_checks: controlesRequis.map((context) => ({ context })),
            },
          },
        ],
      });
      return { ok: true };
    } catch (e) {
      // Le motif exact est journalisé : sans lui, on ne sait pas pourquoi GitHub a refusé.
      this.journal.warn(`Protection de main refusée sur ${owner}/${repo} : ${decrireErreurGithub(e)}`);
      return { ok: false, statut: statut(e), message: (e as Error).message ?? '' };
    }
  }

  async proteger(gh: Octokit, owner: string, repo: string, controlesRequis: string[]): Promise<'fait' | 'a-faire'> {
    // Compte personnel gratuit + dépôt privé : règles indisponibles (403/422).
    return (await this.poserRegle(gh, owner, repo, controlesRequis)).ok ? 'fait' : 'a-faire';
  }

  /** Règles en vigueur sur une branche ; null si GitHub ne les montre pas. */
  private async reglesBranche(gh: Octokit, owner: string, repo: string, branche: string): Promise<RegleBranche[] | null> {
    try {
      const { data } = await gh.request('GET /repos/{owner}/{repo}/rules/branches/{branch}', { owner, repo, branch: branche });
      return data as RegleBranche[];
    } catch (e) {
      this.journal.warn(`Règles de ${owner}/${repo}@${branche} illisibles : ${decrireErreurGithub(e)}`);
      return null;
    }
  }

  /**
   * Contrôles que GitHub exige réellement avant de fusionner sur cette branche (règle de protection).
   * null : aucune règle n'en exige. C'est cette liste, et non `ada.json` (un fichier du dépôt que
   * d'autres peuvent modifier), qui fait foi quand elle existe.
   */
  async controlesExiges(gh: Octokit, owner: string, repo: string, branche: string): Promise<string[] | null> {
    const regles = await this.reglesBranche(gh, owner, repo, branche);
    const contextes = (regles ?? [])
      .filter((regle) => regle.type === 'required_status_checks')
      .flatMap((regle) => regle.parameters?.required_status_checks ?? [])
      .map((controle) => controle.context);
    return contextes.length ? [...new Set(contextes)] : null;
  }

  /** Dernier constat par projet : à chaque ouverture, on ne redemande pas GitHub (un refus est gardé plus longtemps). */
  private readonly constats = new Map<string, { protection: Protection; expire: number }>();

  private memoriser(cle: string, protection: Protection): Protection {
    this.constats.set(cle, { protection, expire: Date.now() + (protection.etat === 'impossible' ? 60 : 10) * 60_000 });
    return protection;
  }

  /** Choix du PO pour un projet repris (« ne pas protéger »), gardé par ADA hors de GitHub. */
  private fichierChoix(depot: string): string {
    lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE); // identifiant bien formé : jamais un chemin
    return join(resolve(this.config.DOSSIER_APERCUS), depot.toLowerCase(), 'protection.json');
  }

  private async refusee(depot: string): Promise<boolean> {
    try {
      return (JSON.parse(await readFile(this.fichierChoix(depot), 'utf8')) as { refusee?: boolean }).refusee === true;
    } catch {
      return false;
    }
  }

  /**
   * À l'ouverture d'un projet : la branche principale doit être protégée (PR et contrôles verts
   * obligatoires). Projet créé par ADA : si aucune règle ne l'exige, ADA pose la sienne, avec les
   * contrôles de `ada.json` (une protection qui avait échoué à la création est ainsi retentée).
   * Projet repris : ADA ne pose rien d'elle-même ; elle propose, et le PO décide.
   */
  async assurer(jeton: string, depot: string): Promise<Protection> {
    const { owner, repo } = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
    const cle = `${owner}/${repo}`.toLowerCase();
    const connue = this.constats.get(cle);
    if (connue && connue.expire > Date.now()) return connue.protection;
    const gh = this.github.client(jeton);
    const lien = `https://github.com/${owner}/${repo}/rules`;
    try {
      const { data: depotGithub } = await gh.repos.get({ owner, repo });
      const branche = depotGithub.default_branch ?? 'main';
      const regles = await this.reglesBranche(gh, owner, repo, branche);
      if ((regles ?? []).some((regle) => regle.type === 'pull_request')) return this.memoriser(cle, { etat: 'protegee', raison: null, lien });
      if ((depotGithub.topics ?? []).includes(TOPIC_REPRISE)) {
        return this.memoriser(cle, { etat: (await this.refusee(depot)) ? 'refusee' : 'a-proposer', raison: null, lien });
      }
      return this.memoriser(cle, await this.poser(gh, owner, repo, branche, depotGithub.private, lien));
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  private async poser(gh: Octokit, owner: string, repo: string, branche: string, prive: boolean, lien: string): Promise<Protection> {
    const { controlesRequis } = await this.lireConfigDepot(gh, owner, repo, branche);
    const resultat = await this.poserRegle(gh, owner, repo, controlesRequis);
    return resultat.ok ? { etat: 'posee', raison: null, lien } : { etat: 'impossible', raison: raisonRefusProtection(resultat, prive), lien };
  }

  /** Le PO accepte qu'ADA protège la branche principale (projet repris) : ADA pose la règle, à son nom. */
  async poserSurDemande(jeton: string, depot: string, login: string): Promise<Protection> {
    const { owner, repo } = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
    const gh = this.github.client(jeton);
    const lien = `https://github.com/${owner}/${repo}/rules`;
    try {
      const { data: depotGithub } = await gh.repos.get({ owner, repo });
      const protection = await this.poser(gh, owner, repo, depotGithub.default_branch ?? 'main', depotGithub.private, lien);
      if (protection.etat === 'posee') {
        await rm(this.fichierChoix(depot), { force: true });
        this.journal.log(`Branche principale de ${owner}/${repo} protégée à la demande de ${login}`);
      }
      return this.memoriser(`${owner}/${repo}`.toLowerCase(), protection);
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  /** Le PO ne veut pas protéger la branche (projet repris) : ADA le retient et ne redemande pas. */
  async refuser(depot: string, login: string): Promise<Protection> {
    const { owner, repo } = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
    const fichier = this.fichierChoix(depot);
    await mkdir(dirname(fichier), { recursive: true });
    await writeFile(fichier, JSON.stringify({ refusee: true, par: login, le: new Date().toISOString() }));
    return this.memoriser(`${owner}/${repo}`.toLowerCase(), { etat: 'refusee', raison: null, lien: `https://github.com/${owner}/${repo}/rules` });
  }
}

/** Pourquoi GitHub n'a pas accepté la protection, dit au PO en clair. */
function raisonRefusProtection(refus: { statut?: number; message: string }, prive: boolean): string {
  if (prive && (refus.statut === 403 || refus.statut === 422)) {
    return 'GitHub ne permet pas de protéger un dépôt privé sur un compte personnel gratuit.';
  }
  return `GitHub a refusé la règle${refus.statut ? ` (${refus.statut})` : ''} : ${refus.message || 'sans motif donné'}.`;
}
