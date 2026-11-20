/**
 * Ce que toutes les phases de l'agent partagent : lire la demande figée, exécuter l'agent, tenir le
 * fil d'activité, préparer et envoyer la branche, ouvrir la PR, signaler un blocage au PO.
 */
import type { Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ApercuService } from '../apercu/apercu.service.js';
import type { Config } from '../config.js';
import { lireUsages, type UsageModele } from '../empreinte/empreinte.js';
import { noterEmpreinte } from '../empreinte/journal-empreinte.js';
import type { GithubService } from '../github/github.service.js';
import { lireIdentifiant } from '../projets/depot.js';
import { PREFIXE_CONVERSATION, PREFIXE_LIBRE } from '../stories/story.js';
import { DEBUT_LANCEMENT, MARQUEUR_ASSISTANT, type StoriesService } from '../stories/stories.service.js';
import type { Demande, Phase, StoryExistante } from './agent.js';
import { decrireEvenement } from './activite.js';
import { equiperSkills } from './equiper-skills.js';
import { fichiersModifies } from './fichiers-modifies.js';
import type { Activite, JournalActivite } from './journal-activite.js';
import { optionModele, type LancerAgent } from './lancement.js';
import { cheminsReserves, OPTIONS_ISOLEMENT, OUTILS_INTERDITS, outilsAutorises } from './outils.js';

/** Tours maximum de l'agent par phase. */
const TOURS: Record<Phase, number> = { analyse: 30, realisation: 150, reprise: 40, conversation: 100 };

export class OutilsPhase {
  private indexRgaa: string | null | undefined;

  constructor(
    readonly config: Config,
    readonly github: GithubService,
    readonly stories: StoriesService,
    readonly apercu: ApercuService,
    private readonly journal: JournalActivite,
    /** L'agent à lancer, lu à chaque exécution (les tests le remplacent). */
    private readonly lancerAgent: () => LancerAgent,
    readonly log: Logger,
  ) {}

  noter(depot: string, numero: number, texte: string): Promise<void> {
    return this.journal.noter(depot, numero, texte);
  }

  enregistrer(depot: string, numero: number, maj: Partial<Activite>): Promise<Activite> {
    return this.journal.enregistrer(depot, numero, maj);
  }

  lireActivite(depot: string, numero: number): Promise<Activite> {
    return this.journal.lire(depot, numero);
  }

  /** Index RGAA lu une fois ; absent → l'assistant garde les bases (ACCESSIBILITE). */
  async lireIndexRgaa(): Promise<string | null> {
    if (this.indexRgaa !== undefined) return this.indexRgaa;
    try {
      this.indexRgaa = await readFile(resolve(this.config.RGAA_INDEX), 'utf8');
    } catch {
      this.log.warn(`Index RGAA introuvable (${this.config.RGAA_INDEX}) : l'assistant n'aura que les bases`);
      this.indexRgaa = null;
    }
    return this.indexRgaa;
  }

  equiperSkills(cwd: string): Promise<{ noms: string[]; dossiers: string[] }> {
    return equiperSkills(cwd, this.config.AGENT_SKILLS, (message) => this.log.warn(message));
  }

  /** Les autres stories du projet, les plus récentes d'abord : ADA s'en sert pour éviter les doublons. */
  async existantes(jeton: string, depot: string, numero: number): Promise<StoryExistante[]> {
    const stories = await this.stories.lister(jeton, depot);
    return stories
      // Les titres de ces demandes entrent dans la consigne de l'agent : pas ceux d'un auteur sans droit d'écriture.
      .filter((story) => story.numero !== numero && story.fiable !== false)
      .map((story) => ({
        numero: story.numero,
        titre: story.titre,
        livree: story.fermeeLe !== null,
        parent: story.parent,
        decoupee: story.statut === 'parent',
      }));
  }

  /**
   * La demande telle qu'ADA l'a figée au lancement, et les échanges faits par son interface
   * (journal d'ADA). L'agent ne lit jamais l'issue vivante ni ses commentaires : un titre, un
   * label ou un commentaire écrits à la main sur GitHub ne peuvent pas lui donner de consigne.
   */
  async demande(jeton: string, depot: string, numero: number): Promise<Demande> {
    const { fige, messages } = await this.stories.demandeFigee(jeton, depot, numero);
    const depart = messages.findIndex((m) => m.texte.startsWith(DEBUT_LANCEMENT));
    const echanges = messages
      .slice(depart + 1)
      .map((m) =>
        m.texte.startsWith(MARQUEUR_ASSISTANT)
          ? { auteur: 'assistant' as const, texte: m.texte.replace(MARQUEUR_ASSISTANT, '').trim() }
          : { auteur: 'po' as const, texte: m.texte.trim() },
      );
    return {
      numero,
      titre: fige.titre,
      type: fige.type,
      contenu: fige.contenu,
      contenuBug: fige.contenuBug,
      contenuLibre: fige.contenuLibre,
      parent: fige.parent,
      echanges,
    };
  }

  /** Exécute une phase de l'agent et renvoie sa réponse finale (texte). */
  async executer(
    depot: string,
    numero: number,
    phase: Phase,
    consigne: string,
    cwd: string,
    dossiersLisibles: string[] = [],
    /** Conversation : session nommée (premier message) ou reprise (messages suivants). */
    session: { id: string; reprendre: boolean } | null = null,
  ): Promise<string> {
    let resultat = '';
    let usages: UsageModele[] = [];
    const args = [
      '-p',
      consigne,
      '--output-format',
      'stream-json',
      '--verbose',
      ...optionModele(this.config.AGENT_MODELE),
      '--max-turns',
      String(TOURS[phase]),
      ...OPTIONS_ISOLEMENT,
      ...(session ? (session.reprendre ? ['--resume', session.id] : ['--session-id', session.id]) : ['--no-session-persistence']),
      '--disallowedTools',
      ...OUTILS_INTERDITS,
      '--allowedTools',
      ...outilsAutorises(phase, dossiersLisibles),
    ];
    const notes: Promise<void>[] = [];
    const code = await this.lancerAgent()(args, cwd, (ligne) => {
      for (const texte of decrireEvenement(ligne)) notes.push(this.noter(depot, numero, texte));
      try {
        const evt = JSON.parse(ligne) as { type?: string; result?: string; modelUsage?: unknown };
        if (evt.type === 'result' && typeof evt.result === 'string') resultat = evt.result;
        if (evt.type === 'result') usages = lireUsages(evt.modelUsage);
      } catch {
        /* ligne non JSON : ignorée */
      }
    });
    await Promise.all(notes);
    // Empreinte carbone : tokens par modèle seulement, jamais de contenu ; une erreur d'écriture
    // ne doit pas faire échouer le travail du PO.
    await noterEmpreinte(this.config.DOSSIER_REGISTRE, { le: new Date().toISOString(), projet: depot, numero, phase, session: session?.id ?? null, usages }).catch((e: unknown) =>
      this.log.warn(`Empreinte de ${depot}#${numero} non notée : ${(e as Error).message}`),
    );
    if (code !== 0 && !resultat) throw new Error(`L’agent s’est arrêté (code ${code})`);
    return resultat;
  }

  /**
   * Met le dépôt de l'aperçu sur la branche de la demande. Déjà sur cette branche avec des
   * modifications non enregistrées : c'est le travail d'une exécution interrompue de la même
   * demande, on le garde pour que l'assistant le reprenne. Sur une autre branche, on refuse :
   * on mélangerait deux demandes.
   */
  async preparerBranche(jeton: string, login: string, depot: string, branche: string): Promise<{ cwd: string; travailRepris: boolean }> {
    const cwd = await this.apercu.preparerDepot(jeton, depot);
    const git = (...args: string[]) => this.apercu.executer('git', ['-C', cwd, ...args]);
    await git('config', 'user.name', login);
    await git('config', 'user.email', `${login}@users.noreply.github.com`);
    const { stdout: etat } = await git('status', '--porcelain');
    const modifies = etat
      .split('\n')
      .map((ligne) => ligne.slice(3).trim())
      .filter(Boolean);
    // npm install (au démarrage de l'aperçu) retouche parfois les package-lock.json : on les rétablit.
    const verrous = modifies.filter((fichier) => fichier.endsWith('package-lock.json'));
    if (verrous.length) await git('checkout', '--', ...verrous);
    const autres = modifies.length - verrous.length;
    const { stdout: courante } = await git('rev-parse', '--abbrev-ref', 'HEAD');
    if (autres > 0) {
      if (courante.trim() === branche) return { cwd, travailRepris: true };
      throw new Error('Le dépôt de l’aperçu contient des modifications non enregistrées');
    }
    const { stdout: existantes } = await git('branch', '--list', branche);
    if (existantes.trim()) await git('checkout', '--quiet', branche);
    else await git('checkout', '--quiet', '-b', branche, 'origin/main');
    return { cwd, travailRepris: false };
  }

  /** Nombre de commits de la branche au-delà d'une référence (`origin/main..branche`, par exemple). */
  async compterCommits(cwd: string, ...plage: string[]): Promise<number> {
    const { stdout } = await this.apercu.executer('git', ['-C', cwd, 'rev-list', '--count', ...plage]);
    return Number(stdout.trim());
  }

  /** Envoie la branche (jamais main) et retient le commit poussé : la fusion refusera une branche qui a avancé hors d'ADA. */
  async pousser(jeton: string, depot: string, numero: number, cwd: string, branche: string): Promise<void> {
    await this.noter(depot, numero, 'Envoie la branche sur GitHub');
    await this.apercu.executer('git', ['-C', cwd, 'push', '--quiet', '-u', 'origin', branche], { env: this.apercu.environnementGit(jeton) });
    const { stdout } = await this.apercu.executer('git', ['-C', cwd, 'rev-parse', 'HEAD']);
    await this.enregistrer(depot, numero, { tete: stdout.trim() || null });
  }

  /** L'aperçu doit montrer ce travail, API comprise, pour que le PO vérifie le vrai résultat. */
  async relancerApercu(depot: string, numero: number): Promise<void> {
    await this.noter(depot, numero, 'Relance l’aperçu');
    await this.apercu.relancerApplication(depot).catch((e: unknown) => this.log.warn(`Relance de l’aperçu de ${depot} : ${(e as Error).message.split('\n')[0]}`));
  }

  async ouvrirPullRequest(jeton: string, depot: string, cwd: string, branche: string, demande: Demande, resume: string): Promise<string> {
    let fiche = '';
    try {
      fiche = await readFile(join(cwd, 'revues', `${branche.replace('/', '-')}.md`), 'utf8');
    } catch {
      /* pas de fiche : le résumé suffit */
    }
    const { data } = await this.github.client(jeton).pulls.create({
      ...lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE),
      head: branche,
      base: 'main',
      // Mode libre : sans le préfixe « Demande libre : », pour des notes de version lisibles.
      title: `${demande.type === 'bug' ? 'fix' : 'feat'}: ${demande.titre.replace(PREFIXE_LIBRE, '').replace(PREFIXE_CONVERSATION, '')}`,
      body: `${resume}\n\nCloses #${demande.numero}\n\n${fiche}`.trim(),
    });
    return data.html_url;
  }

  /**
   * Garde-fou avant tout envoi : aucun fichier de .github/ ni de charts/ ne doit changer, quel que
   * soit l'outil utilisé (les interdits de l'agent ne couvrent que l'édition directe).
   */
  async toucheDossiersReserves(jeton: string, depot: string, numero: number, cwd: string, branche: string): Promise<boolean> {
    const reserves = cheminsReserves(await fichiersModifies(this.apercu.executer, cwd, branche));
    if (!reserves.length) return false;
    await this.bloquer(
      jeton,
      depot,
      numero,
      `J'ai modifié des fichiers réservés aux développeurs (${reserves.join(', ')}). Je n'envoie rien : un développeur doit vérifier.`,
    );
    return true;
  }

  async bloquer(jeton: string, depot: string, numero: number, raison: string): Promise<void> {
    // La raison d'abord, en local : si GitHub refuse l'écriture (jeton expiré, coupure), l'écran du
    // PO l'affiche quand même, avec « Relancer ADA », au lieu d'un « en cours » muet.
    await this.enregistrer(depot, numero, { erreur: raison });
    try {
      await this.stories.commenterAssistant(jeton, depot, numero, 'Besoin d’aide', `${raison}\n\nUn développeur doit regarder cette demande.`);
      await this.stories.changerStatut(jeton, depot, numero, 'besoin-dev');
    } catch (e) {
      this.log.warn(`Blocage de ${depot}#${numero} non écrit dans GitHub : ${(e as Error).message}`);
    }
    await this.noter(depot, numero, 'Bloqué : un développeur doit intervenir');
  }
}
