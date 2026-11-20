/**
 * Ce que le PO demande à l'agent : lancer, relancer, valider un plan, converser, arrêter. Chaque
 * action vérifie qu'elle peut démarrer AVANT d'écrire dans GitHub, puis confie la tâche à
 * l'ordonnanceur ; le travail de chaque phase est décrit dans phase-*.ts.
 */
import { BadRequestException, ConflictException, Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { dirname, join, resolve } from 'node:path';
import { ApercuService } from '../apercu/apercu.service.js';
import { CONFIG, type Config } from '../config.js';
import { EQUIVALENTS } from '../empreinte/empreinte.js';
import { lireEmpreintes, sommer } from '../empreinte/journal-empreinte.js';
import { GithubService } from '../github/github.service.js';
import { lireIdentifiant } from '../projets/depot.js';
import { ProjetsService } from '../projets/projets.service.js';
import { StoriesService, type DetailStory } from '../stories/stories.service.js';
import { verifierMessage } from '../stories/story.js';
import type { Tache } from './agent.js';
import type { ConseilStack } from './conseil-stack.js';
import { ConseillerStack } from './conseiller-stack.js';
import { FileAttente } from './file-attente.js';
import { JournalActivite, type Activite } from './journal-activite.js';
import { lancerParDefaut, type LancerAgent } from './lancement.js';
import { Ordonnanceur } from './ordonnanceur.js';
import { OutilsPhase } from './outils-phase.js';
import { phaseAnalyse } from './phase-analyse.js';
import { phaseConversation } from './phase-conversation.js';
import { phaseRealisation } from './phase-realisation.js';
import { phaseReprise } from './phase-reprise.js';
import { VerrouProjet } from './verrou-projet.js';
import type { Verrou } from './verrou.js';

@Injectable()
export class AgentService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AgentService.name);
  lancerAgent: LancerAgent;
  private readonly journal: JournalActivite;
  private readonly verrou: VerrouProjet;
  private readonly file: FileAttente;
  private readonly ordonnanceur: Ordonnanceur;
  private readonly outils: OutilsPhase;
  private readonly conseiller: ConseillerStack;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly github: GithubService,
    private readonly stories: StoriesService,
    private readonly apercu: ApercuService,
    projets: ProjetsService,
  ) {
    this.lancerAgent = lancerParDefaut(config.AGENT_COMMANDE);
    // Dossier de travail de l'agent pour un projet : à côté de son aperçu.
    const dossierAgent = (depot: string) => join(dirname(this.apercu.cheminDepot(depot)), 'agent');
    this.journal = new JournalActivite(dossierAgent);
    this.verrou = new VerrouProjet(dossierAgent);
    this.file = new FileAttente(() => join(resolve(this.config.DOSSIER_APERCUS), '.file-attente'));
    this.outils = new OutilsPhase(config, github, stories, apercu, this.journal, () => this.lancerAgent, this.log);
    this.conseiller = new ConseillerStack(config, projets, () => this.lancerAgent, this.log);
    const travailler = (tache: Tache): Promise<void> => {
      if (tache.phase === 'analyse') return phaseAnalyse(this.outils, tache);
      if (tache.phase === 'reprise') return phaseReprise(this.outils, projets, tache);
      if (tache.phase === 'conversation') return phaseConversation(this.outils, tache);
      return phaseRealisation(this.outils, tache);
    };
    this.ordonnanceur = new Ordonnanceur({ config, apercu, verrou: this.verrou, journal: this.journal, file: this.file, travailler, dossierAgent, log: this.log });
  }

  /** Vrai : chaque tâche tourne dans un processus travailleur détaché (voir Ordonnanceur). */
  get travailleurSepare(): boolean {
    return this.ordonnanceur.travailleurSepare;
  }

  set travailleurSepare(valeur: boolean) {
    this.ordonnanceur.travailleurSepare = valeur;
  }

  /** Dernière tâche de fond lancée (permet aux tests d'en attendre la fin). */
  get derniereTache(): Promise<void> {
    return this.ordonnanceur.derniereTache;
  }

  onModuleInit(): void {
    this.ordonnanceur.demarrerMinuteur();
  }

  onModuleDestroy(): void {
    this.ordonnanceur.arreterMinuteur();
  }

  /** Verrou du projet, s'il est tenu par un processus vivant qui bat encore. */
  verrouActif(depot: string): Promise<Verrou | null> {
    return this.verrou.actif(depot);
  }

  /** Une tâche de ce projet (et de cette demande, si précisée) attend son tour. */
  enFile(depot: string, numero?: number): Promise<boolean> {
    return this.file.contient(depot, numero);
  }

  traiterFile(maintenant = Date.now()): Promise<void> {
    return this.ordonnanceur.traiterFile(maintenant);
  }

  /** Exécute la tâche dans ce processus (travailleur, ou tests) et tient l'activité à jour. */
  executerTache(tache: Tache): Promise<void> {
    return this.ordonnanceur.executer(tache);
  }

  verifierLibre(depot: string): Promise<void> {
    return this.ordonnanceur.verifierLibre(depot);
  }

  /**
   * Tout ce qui doit être vrai pour lancer ou relancer ADA sur ce projet, vérifié avant la moindre
   * écriture dans GitHub : agent configuré, projet sous son nom actuel, projet libre.
   */
  async verifierLancable(jeton: string, depot: string): Promise<void> {
    this.verifierDisponible();
    await this.verifierNomActuel(jeton, depot);
    await this.verifierLibre(depot);
  }

  verifierDisponible(): void {
    if (!this.config.AGENT_COMMANDE) {
      throw new BadRequestException('Aucun agent n’est configuré pour cet atelier (AGENT_COMMANDE). Prévenez son administrateur.');
    }
  }

  /**
   * Un dépôt renommé sur GitHub reste joignable sous son ancien nom (redirection) : ADA, qui range
   * verrou, journal et aperçu sous le nom, y verrait deux projets et pourrait lancer deux agents
   * sur la même story. On refuse donc tout lancement sous un nom périmé.
   */
  private async verifierNomActuel(jeton: string, depot: string): Promise<void> {
    const cible = lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
    const { data } = await this.github.client(jeton).repos.get({ owner: cible.owner, repo: cible.repo });
    if (data.name.toLowerCase() !== cible.repo.toLowerCase()) {
      throw new ConflictException(
        `Ce projet a été renommé « ${data.name} » sur GitHub. Rouvrez-le sous ce nom dans la liste des projets, puis relancez.`,
      );
    }
  }

  /** Empreinte estimée d'une demande (toutes ses exécutions de l'agent). */
  async empreinteDemande(depot: string, numero: number) {
    const entrees = (await lireEmpreintes(this.config.DOSSIER_REGISTRE)).filter((entree) => entree.projet === depot && entree.numero === numero);
    return entrees.length ? { empreinte: sommer(entrees), equivalents: EQUIVALENTS } : null;
  }

  /** Empreinte estimée d'un projet : toutes les exécutions de l'agent, toutes demandes confondues. */
  async empreinteProjet(depot: string) {
    const entrees = (await lireEmpreintes(this.config.DOSSIER_REGISTRE)).filter((entree) => entree.projet === depot);
    if (!entrees.length) return null;
    return { empreinte: sommer(entrees), demandes: new Set(entrees.map((entree) => entree.numero)).size, equivalents: EQUIVALENTS };
  }

  /** « En cours » seulement si un agent tourne vraiment (pas un reste d'exécution interrompue). */
  async activite(depot: string, numero: number): Promise<Activite> {
    const activite = await this.journal.lire(depot, numero);
    const verrou = await this.verrou.actif(depot);
    const enCours = activite.enCours && (verrou?.numero === numero || (await this.file.contient(depot, numero)));
    return { ...activite, enCours };
  }

  /** Mémorise le commit que ADA vient de pousser (null : ne plus rien comparer). */
  async noterTete(depot: string, numero: number, sha: string | null): Promise<void> {
    await this.journal.enregistrer(depot, numero, { tete: sha });
  }

  conseillerStack(idee: unknown): Promise<ConseilStack> {
    return this.conseiller.conseiller(idee);
  }

  /**
   * Démarre une tâche pour la demande : une seule par projet et au plus AGENT_MAX_SIMULTANES sur
   * toute la machine ; au-delà, elle attend son tour (voir Ordonnanceur).
   */
  private async lancerTache(tache: Tache): Promise<void> {
    this.verifierDisponible();
    await this.verifierNomActuel(tache.jeton, tache.depot);
    await this.ordonnanceur.lancer(tache);
  }

  /**
   * Le détail d'une demande qu'on s'apprête à confier à l'agent. Une demande lancée avant que son
   * état vive dans ADA (ADR-0011) est figée depuis l'issue vivante au premier passage de l'agent :
   * si son auteur n'a pas le droit d'écrire dans le projet, elle ne lui est pas confiée.
   */
  private async detailFiable(jeton: string, depot: string, numero: number): Promise<DetailStory> {
    const detail = await this.stories.detail(jeton, depot, numero);
    if (detail.fiable === false) throw new ConflictException(`ADA ne reprend pas la demande #${numero} : ${detail.raison ?? 'son auteur n’a pas le droit d’écrire dans le projet'}`);
    return detail;
  }

  /**
   * Demande en cours ou bloquée sans agent actif. Plan déjà validé (dernière phase : réalisation)
   * → on reprend la réalisation ; sinon → nouvelle analyse.
   */
  async relancer(jeton: string, login: string, depot: string, numero: number): Promise<void> {
    await this.verifierLancable(jeton, depot);
    const detail = await this.detailFiable(jeton, depot, numero);
    if (detail.statut !== 'en-cours' && detail.statut !== 'besoin-dev') {
      throw new ConflictException('Cette demande n’a pas besoin d’être relancée');
    }
    await this.stories.changerStatut(jeton, depot, numero, 'en-cours');
    const precedente = await this.journal.lire(depot, numero);
    if (precedente.phase === 'conversation') {
      await this.journal.noter(depot, numero, 'Reprend la conversation');
      await this.converser(jeton, login, depot, numero);
    } else if (precedente.phase === 'realisation') {
      await this.journal.noter(depot, numero, 'Reprend la réalisation');
      await this.realiser(jeton, login, depot, numero);
    } else {
      await this.analyser(jeton, depot, numero, login);
    }
  }

  /** Analyse : questions ou plan, publiés dans l'issue ; aucune modification du code. */
  analyser(jeton: string, depot: string, numero: number, login = ''): Promise<void> {
    return this.lancerTache({ phase: 'analyse', jeton, login, depot, numero });
  }

  /** Reprise d'un projet existant (#37) : analyse, puis PR de reprise et améliorations proposées. */
  analyserReprise(jeton: string, depot: string, numero: number, login: string, reprise: { modele: string | null }): Promise<void> {
    return this.lancerTache({ phase: 'reprise', jeton, login, depot, numero, reprise });
  }

  /** Le PO demande de revoir le plan, ou répond aux questions : nouvelle analyse. */
  async reprendreAnalyse(jeton: string, depot: string, numero: number, texte: string): Promise<void> {
    await this.verifierLancable(jeton, depot);
    const detail = await this.detailFiable(jeton, depot, numero);
    // Un autre découpage peut aussi être demandé (#36).
    if (detail.statut !== 'questions' && detail.statut !== 'plan-a-valider' && detail.statut !== 'decoupage') {
      throw new ConflictException('ADA n’attend pas de réponse sur cette demande');
    }
    await this.stories.repondre(jeton, depot, numero, texte);
    await this.stories.changerStatut(jeton, depot, numero, 'en-cours');
    await this.analyser(jeton, depot, numero);
  }

  /** Le PO valide le plan : réalisation sur une branche, puis branche poussée et PR ouverte. */
  async validerPlan(jeton: string, login: string, depot: string, numero: number): Promise<void> {
    await this.verifierLancable(jeton, depot);
    const detail = await this.detailFiable(jeton, depot, numero);
    if (detail.statut !== 'plan-a-valider') throw new ConflictException('Aucun plan n’attend votre validation');
    await this.stories.repondre(jeton, depot, numero, `✅ Plan validé par ${login}.`);
    await this.stories.changerStatut(jeton, depot, numero, 'en-cours');
    await this.realiser(jeton, login, depot, numero);
  }

  private realiser(jeton: string, login: string, depot: string, numero: number): Promise<void> {
    return this.lancerTache({ phase: 'realisation', jeton, login, depot, numero });
  }

  /** Conversation : ADA répond au dernier message du PO, en agissant tout de suite sur sa branche. */
  converser(jeton: string, login: string, depot: string, numero: number): Promise<void> {
    return this.lancerTache({ phase: 'conversation', jeton, login, depot, numero });
  }

  /** Le PO écrit dans la conversation : ADA reprend la main. */
  async reprendreConversation(jeton: string, login: string, depot: string, numero: number, texte: unknown): Promise<void> {
    await this.verifierLancable(jeton, depot);
    const verification = verifierMessage(texte, false);
    if (!verification.ok) throw new BadRequestException(verification.erreur);
    const detail = await this.stories.detail(jeton, depot, numero);
    if (detail.type !== 'conversation' || detail.statut !== 'echange') throw new ConflictException('ADA n’attend pas de message dans cette conversation');
    await this.stories.repondre(jeton, depot, numero, verification.texte);
    await this.stories.changerStatut(jeton, depot, numero, 'en-cours');
    await this.converser(jeton, login, depot, numero);
  }

  /**
   * « C'est bon » : ADA lance les contrôles complets (une seule fois), puis propose les changements
   * au projet (PR), ou ferme la conversation s'il n'y en a aucun. Tâche de l'agent, en arrière-plan.
   */
  async terminerConversation(jeton: string, login: string, depot: string, numero: number): Promise<void> {
    await this.verifierLancable(jeton, depot);
    const detail = await this.stories.detail(jeton, depot, numero);
    if (detail.type !== 'conversation' || detail.statut !== 'echange') throw new ConflictException('Cette conversation ne peut pas être terminée maintenant');
    await this.stories.repondre(jeton, depot, numero, `✅ C’est bon : ${login} demande de proposer ces changements au projet.`);
    await this.stories.changerStatut(jeton, depot, numero, 'en-cours');
    await this.lancerTache({ phase: 'conversation', jeton, login, depot, numero, finaliser: true });
  }

  /** Le PO arrête la conversation : rien n'arrive sur le projet (la branche reste sur GitHub). */
  async arreterConversation(jeton: string, login: string, depot: string, numero: number): Promise<void> {
    if ((await this.verrouActif(depot)) || (await this.enFile(depot))) throw new ConflictException('ADA travaille encore : attendez sa réponse');
    const detail = await this.stories.detail(jeton, depot, numero);
    if (detail.type !== 'conversation' || detail.statut === 'livree') throw new ConflictException('Cette conversation est déjà terminée');
    await this.stories.fermerSansSuite(jeton, depot, numero, `💬 Conversation arrêtée par ${login} : rien n’est ajouté au projet.`);
  }
}
