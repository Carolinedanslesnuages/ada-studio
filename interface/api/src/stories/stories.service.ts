import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { CONFIG, type Config } from '../config.js';
import { GithubService } from '../github/github.service.js';
import { traduireErreurGithub } from '../github/erreurs.js';
import {
  formaterPrompt,
  LABEL_BUG,
  LABEL_LIBRE,
  LABEL_STORY,
  lireBug,
  lirePrompt,
  lireConversation,
  formaterConversation,
  titreConversation,
  verifierMessage,
  LABEL_CONVERSATION,
  lireStory,
  empreinteDemande,
  STATUTS,
  STATUTS_ACTIFS,
  statutDepuis,
  titrePrompt,
  typeDepuis,
  verifierPrompt,
  type Statut,
  type TypeDemande,
} from './story.js';
import { lireIdentifiant, type CibleDepot } from '../projets/depot.js';
import { Decoupage } from './decoupage.js';
import { DroitsAuteur } from './droits-auteur.js';
import { assurerLabel } from './labels.js';
import { figeeDepuisIssue, nomsLabels, resumer, type DetailStory, type Issue, type Message, type Personne, type ResumeStory } from './resume-story.js';
import { DemandesStore, type DemandeFigee, type MessageJournal } from './demandes.js';

/** Marque les commentaires écrits par l'assistant, pour reconstituer les échanges. */
export const MARQUEUR_ASSISTANT = '<!-- ada-studio:assistant -->';
import { MARQUEUR_LANCEMENT } from './story.js';
/** Marque le commentaire de lancement : les échanges utiles à l'agent commencent après. */
export { MARQUEUR_LANCEMENT } from './story.js';
/** Début du commentaire de lancement (« depuis ADA », ou « depuis l’atelier PO » avant le renommage). */
export const DEBUT_LANCEMENT = '▶️ Lancée depuis ';

export type { DetailStory, Message, Personne, ResumeStory } from './resume-story.js';

@Injectable()
export class StoriesService {
  private readonly journal = new Logger(StoriesService.name);

  private readonly droits: DroitsAuteur;
  private readonly decoupage: Decoupage;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly github: GithubService,
    private readonly demandes: DemandesStore,
  ) {
    this.droits = new DroitsAuteur((depot) => this.cible(depot));
    this.decoupage = new Decoupage(this, github, demandes, (depot) => this.cible(depot));
  }

  /**
   * Statut d'une demande : celui qu'ADA a enregistré, jamais celui des labels de GitHub (que toute
   * personne ayant des droits sur le dépôt peut changer). Une demande fermée est livrée. Tant que
   * les statuts déjà posés sur GitHub n'ont pas été repris (premier passage), les labels font foi.
   */
  private async statutDe(depot: string, issue: Issue, repris: boolean): Promise<Statut> {
    if (issue.state === 'closed') return 'livree';
    const enregistre = await this.demandes.lireStatut(depot, issue.number);
    if (enregistre) return enregistre;
    return repris ? 'nouvelle' : statutDepuis('open', nomsLabels(issue.labels));
  }

  /** Premier passage sur un projet : les statuts que les labels portaient jusqu'ici deviennent ceux d'ADA. */
  private async reprendreStatuts(depot: string, issues: Issue[]): Promise<void> {
    for (const issue of issues) {
      if (issue.state === 'closed') continue;
      const statut = statutDepuis('open', nomsLabels(issue.labels));
      if (statut !== 'nouvelle' && !(await this.demandes.lireStatut(depot, issue.number))) await this.demandes.ecrireStatut(depot, issue.number, statut);
    }
    await this.demandes.marquerStatutsRepris(depot);
  }

  /** La demande part : figée telle qu'elle est, statut « en cours », et le lancement ouvre le journal des échanges. */
  private async enregistrerLancement(depot: string, figee: DemandeFigee, login: string, texte: string): Promise<void> {
    await this.demandes.figer(depot, figee);
    await this.demandes.ecrireStatut(depot, figee.numero, 'en-cours');
    await this.demandes.ajouterMessage(depot, figee.numero, { auteur: login, texte });
  }

  /** Compte et dépôt GitHub d'un projet d'ADA (voir projets/depot.ts). */
  private cible(depot: string): CibleDepot {
    return lireIdentifiant(depot, this.config.GITHUB_PROPRIETAIRE);
  }

  /**
   * Stories et problèmes écrits dans GitHub, du plus récent au plus ancien : issues portant le
   * label, ou rédigées avec le formulaire même si le label manquait dans le dépôt. Une demande
   * fermée sans être réalisée (doublon, abandon) n'apparaît pas : elle n'a pas été livrée.
   */
  async lister(jeton: string, depot: string): Promise<ResumeStory[]> {
    const gh = this.github.client(jeton);
    try {
      const issues = (await gh.paginate(gh.issues.listForRepo, {
        ...this.cible(depot),
        state: 'all',
        per_page: 100,
      })) as Issue[];
      const retenues = issues
        .filter((i) => !i.pull_request && i.state_reason !== 'not_planned' && typeDepuis(nomsLabels(i.labels), i.body ?? '') !== null)
        .sort((a, b) => b.number - a.number);
      // Un appel à GitHub par auteur (gardé 5 minutes), pas par issue.
      const fiables = new Map<string, boolean>();
      await Promise.all(
        [...new Set(retenues.map((i) => `${i.author_association ?? ''}|${i.user?.login ?? ''}`))].map(async (cle) => {
          const [lien = '', login = ''] = cle.split('|');
          fiables.set(cle, await this.droits.fiable(gh, depot, lien, login));
        }),
      );
      if (!(await this.demandes.statutsRepris(depot))) await this.reprendreStatuts(depot, retenues);
      return Promise.all(
        retenues.map(async (i) => resumer(i, fiables.get(`${i.author_association ?? ''}|${i.user?.login ?? ''}`) ?? false, await this.statutDe(depot, i, true))),
      );
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  /**
   * Détail d'une demande. Une fois lancée, elle s'affiche telle qu'ADA l'a figée, avec le journal
   * des échanges faits par l'interface : un commentaire écrit à la main sur GitHub n'y paraît pas
   * (il n'imiterait pas ADA et n'arriverait pas à l'agent). Avant le lancement, ou pour une demande
   * lancée avant ce changement, on lit GitHub, en ne gardant que les auteurs de confiance.
   */
  async detail(jeton: string, depot: string, numero: number): Promise<DetailStory> {
    const gh = this.github.client(jeton);
    try {
      const [figee, journal, repris] = await Promise.all([this.demandes.lireFigee(depot, numero), this.demandes.messages(depot, numero), this.demandes.statutsRepris(depot)]);
      const utiliseLeJournal = figee !== null && journal.length > 0;
      const [{ data: issue }, commentaires] = await Promise.all([
        gh.issues.get({ ...this.cible(depot), issue_number: numero }),
        utiliseLeJournal ? Promise.resolve(null) : gh.issues.listComments({ ...this.cible(depot), issue_number: numero, per_page: 100 }).then((reponse) => reponse.data),
      ]);
      const corps = issue.body ?? '';
      const auteurs = new Map<string, boolean>();
      const fiable = async (lien: string | null | undefined, login: string | null | undefined) => {
        const cle = `${lien ?? ''}|${login ?? ''}`;
        if (!auteurs.has(cle)) auteurs.set(cle, await this.droits.fiable(gh, depot, lien, login));
        return auteurs.get(cle)!;
      };
      const issueFiable = await fiable((issue as Issue).author_association, (issue as Issue).user?.login);
      const resume = resumer(issue as Issue, issueFiable, await this.statutDe(depot, issue as Issue, repris));
      const lancee = figee !== null && resume.statut !== 'nouvelle' && resume.statut !== 'attente';

      let messages: Message[];
      if (utiliseLeJournal) {
        messages = journal.map((message: MessageJournal) => ({ id: message.id, auteur: message.auteur, avatar: null, texte: message.texte, le: message.le }));
      } else {
        // Seuls comptent les commentaires des personnes qui ont le droit d'écrire dans le projet.
        const gardes: NonNullable<typeof commentaires> = [];
        for (const c of commentaires ?? []) if (await fiable(c.author_association, c.user?.login)) gardes.push(c);
        messages = gardes.map((c) => ({ id: c.id, auteur: c.user?.login ?? 'inconnu', avatar: c.user?.avatar_url ?? null, texte: c.body ?? '', le: c.created_at }));
      }
      return {
        ...resume,
        ...(lancee ? { titre: figee.titre, type: figee.type, parent: figee.parent } : {}),
        contenu: lancee ? figee.contenu : lireStory(corps),
        contenuBug: lancee ? figee.contenuBug : lireBug(corps),
        contenuLibre: lancee ? figee.contenuLibre : (lirePrompt(corps) ?? lireConversation(corps)),
        texteBrut: corps,
        assignes: (issue.assignees ?? []).map((personne) => ({ login: personne.login, avatar: personne.avatar_url ?? null })),
        messages,
        empreinte: empreinteDemande(issue.title, corps),
        // Tout commentaire de l'issue qui n'est pas une copie d'un message du journal a été écrit à la main sur GitHub.
        commentairesIgnores: utiliseLeJournal ? Math.max(0, (issue.comments ?? 0) - journal.length) : 0,
      };
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  /**
   * Ce que l'agent lit pour une demande : la demande figée au lancement et le journal des échanges
   * d'ADA. Jamais l'issue vivante. Demande lancée avant ce changement : reprise unique depuis
   * GitHub (auteurs de confiance seulement), puis ADA ne relit plus rien de ce qui s'y écrit.
   */
  async demandeFigee(jeton: string, depot: string, numero: number): Promise<{ fige: DemandeFigee; messages: MessageJournal[] }> {
    const [figee, journal] = await Promise.all([this.demandes.lireFigee(depot, numero), this.demandes.messages(depot, numero)]);
    if (figee && journal.length) return { fige: figee, messages: journal };
    const heritage = await this.detail(jeton, depot, numero);
    const fige = figee ?? {
      numero,
      titre: heritage.titre,
      type: heritage.type,
      contenu: heritage.contenu,
      contenuBug: heritage.contenuBug,
      contenuLibre: heritage.contenuLibre,
      parent: heritage.parent,
      lanceeLe: new Date().toISOString(),
      lanceePar: 'reprise',
    };
    if (!figee) await this.demandes.figer(depot, fige);
    if (!journal.length) for (const message of heritage.messages) await this.demandes.ajouterMessage(depot, numero, { auteur: message.auteur, texte: message.texte });
    return { fige, messages: await this.demandes.messages(depot, numero) };
  }

  /** Personnes qui peuvent être assignées aux issues du dépôt (accès au projet). */
  async developpeurs(jeton: string, depot: string): Promise<Personne[]> {
    const gh = this.github.client(jeton);
    try {
      const personnes = await gh.paginate(gh.issues.listAssignees, { ...this.cible(depot), per_page: 100 });
      return personnes
        .map((personne) => ({ login: personne.login, avatar: personne.avatar_url ?? null }))
        .sort((premiere, seconde) => premiere.login.localeCompare(seconde.login));
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  /**
   * Assigne un développeur à une demande bloquée (« Besoin d'un développeur »), en remplaçant
   * l'assignation éventuelle ; `null` retire l'assignation (possible à tout moment). ADA ne
   * prévient pas le développeur : il l'a été par ailleurs.
   */
  async assigner(jeton: string, depot: string, numero: number, login: unknown): Promise<DetailStory> {
    if (login !== null && (typeof login !== 'string' || !/^[A-Za-z0-9-]{1,39}$/.test(login))) {
      throw new BadRequestException('Choisissez un développeur dans la liste');
    }
    const gh = this.github.client(jeton);
    const { data: issue } = await gh.issues.get({ ...this.cible(depot), issue_number: numero }).catch((e: unknown) => traduireErreurGithub(e));
    if (login !== null) {
      if ((await this.statutDe(depot, issue as Issue, await this.demandes.statutsRepris(depot))) !== 'besoin-dev') {
        throw new BadRequestException('On assigne un développeur seulement à une demande bloquée (« Besoin d’un développeur »)');
      }
      if (!(await this.developpeurs(jeton, depot)).some((personne) => personne.login === login)) {
        throw new BadRequestException(`${login} n’a pas accès au projet : il ne peut pas être assigné`);
      }
    }
    try {
      const actuels = (issue.assignees ?? []).map((personne) => personne.login).filter((actuel) => actuel !== login);
      if (actuels.length) await gh.issues.removeAssignees({ ...this.cible(depot), issue_number: numero, assignees: actuels });
      if (login !== null) await gh.issues.addAssignees({ ...this.cible(depot), issue_number: numero, assignees: [login] });
    } catch (e) {
      traduireErreurGithub(e);
    }
    return this.detail(jeton, depot, numero);
  }
  /**
   * Mode sauvage : le prompt devient une issue « mode-libre » (trace dans GitHub), lancée tout
   * de suite. Mêmes règles qu'une story : une seule demande active par projet.
   */
  async prompter(jeton: string, depot: string, texte: unknown, login: string): Promise<ResumeStory> {
    const verification = verifierPrompt(texte);
    if (!verification.ok) throw new BadRequestException({ erreurs: { texte: verification.erreur } });
    return this.creerEtLancer(jeton, depot, login, { type: 'libre', label: LABEL_LIBRE, titre: titrePrompt(verification.texte), corps: formaterPrompt(verification.texte), mode: 'mode sauvage' });
  }

  /**
   * Conversation (« vrai prompt ») : le premier message devient une issue « mode-conversation »,
   * lancée tout de suite. Une seule demande active par projet, comme le reste.
   */
  async ouvrirConversation(jeton: string, depot: string, texte: unknown, login: string): Promise<ResumeStory> {
    const verification = verifierMessage(texte, true);
    if (!verification.ok) throw new BadRequestException({ erreurs: { texte: verification.erreur } });
    return this.creerEtLancer(jeton, depot, login, { type: 'conversation', label: LABEL_CONVERSATION, titre: titreConversation(verification.texte), corps: formaterConversation(verification.texte), mode: 'conversation' });
  }

  /** Crée l'issue d'une demande écrite dans ADA (mode sauvage, conversation) et la lance aussitôt. */
  private async creerEtLancer(
    jeton: string,
    depot: string,
    login: string,
    demande: { type: TypeDemande; label: string; titre: string; corps: string; mode: string },
  ): Promise<ResumeStory> {
    const active = (await this.lister(jeton, depot)).find((s) => STATUTS_ACTIFS.includes(s.statut));
    if (active) {
      throw new ConflictException(`La demande #${active.numero} « ${active.titre} » est en cours : une seule demande à la fois`);
    }
    const gh = this.github.client(jeton);
    try {
      await assurerLabel(gh, this.cible(depot), demande.label);
      await assurerLabel(gh, this.cible(depot), STATUTS['en-cours']);
      const { data } = await gh.issues.create({ ...this.cible(depot), title: demande.titre, body: demande.corps, labels: [demande.label, STATUTS['en-cours']] });
      const lancement = `${MARQUEUR_LANCEMENT} par ${login} (${demande.mode}).`;
      await gh.issues.createComment({ ...this.cible(depot), issue_number: data.number, body: lancement });
      await this.enregistrerLancement(depot, figeeDepuisIssue(data as Issue, demande.type, login), login, lancement);
      return resumer(data as Issue, true, 'en-cours'); // créée à l'instant par le PO connecté
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  /** Ferme une demande sans la réaliser (« not planned ») : elle disparaît de la liste, sans être livrée. */
  async fermerSansSuite(jeton: string, depot: string, numero: number, commentaire: string): Promise<void> {
    const gh = this.github.client(jeton);
    try {
      await this.demandes.ajouterMessage(depot, numero, { auteur: 'ADA', texte: commentaire });
      await this.demandes.effacerStatut(depot, numero);
      await gh.issues.createComment({ ...this.cible(depot), issue_number: numero, body: commentaire });
      const { data } = await gh.issues.get({ ...this.cible(depot), issue_number: numero });
      const garder = nomsLabels((data as Issue).labels).filter((l) => !l.startsWith('story:'));
      await gh.issues.update({ ...this.cible(depot), issue_number: numero, state: 'closed', state_reason: 'not_planned', labels: garder });
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  /** Lance (ou relance, si elle était en attente) une demande : une seule à la fois par projet, et seulement si elle est prête. */
  async lancer(jeton: string, depot: string, numero: number, login: string, empreinte?: unknown): Promise<ResumeStory> {
    const toutes = await this.lister(jeton, depot);
    const cible = toutes.find((s) => s.numero === numero);
    if (!cible) throw new BadRequestException(`La demande #${numero} n’est ni une story ni un problème de l’atelier`);
    if (cible.statut !== 'nouvelle' && cible.statut !== 'attente') throw new ConflictException(`La demande #${numero} est déjà lancée ou terminée`);
    if (!cible.prete) throw new BadRequestException(`La demande #${numero} n’est pas prête : ${cible.raison}`);
    const active = toutes.find((s) => STATUTS_ACTIFS.includes(s.statut));
    if (active) {
      throw new ConflictException(
        `La demande #${active.numero} « ${active.titre} » est en cours : une seule demande à la fois`,
      );
    }
    // L'empreinte dit ce que le PO a lu à l'écran : sans elle, on ne sait pas ce qu'il lance.
    if (typeof empreinte !== 'string' || !empreinte) throw new BadRequestException('Ouvrez la demande dans ADA et relisez-la avant de la lancer');
    const gh = this.github.client(jeton);
    // L'issue telle qu'elle est maintenant : c'est elle qui sera figée, et elle doit être celle que le PO a lue.
    const { data: issue } = await gh.issues.get({ ...this.cible(depot), issue_number: numero }).catch((e: unknown) => traduireErreurGithub(e));
    if (empreinte !== empreinteDemande(issue.title, issue.body)) {
      throw new ConflictException('Cette demande a été modifiée sur GitHub depuis que vous l’avez ouverte. Relisez-la, puis lancez-la de nouveau.');
    }
    // « Prête » se juge sur ce qui va être figé, pas sur la liste lue un instant plus tôt.
    const fraiche = resumer(issue as Issue, cible.fiable, cible.statut);
    if (!fraiche.prete) throw new BadRequestException(`La demande #${numero} n’est pas prête : ${fraiche.raison}`);
    try {
      const labelType = { bug: LABEL_BUG, libre: LABEL_LIBRE, conversation: LABEL_CONVERSATION, story: LABEL_STORY }[fraiche.type];
      await assurerLabel(gh, this.cible(depot), labelType);
      await assurerLabel(gh, this.cible(depot), STATUTS['en-cours']);
      await gh.issues.addLabels({
        ...this.cible(depot),
        issue_number: numero,
        labels: [labelType, STATUTS['en-cours']],
      });
      if (cible.statut === 'attente') await gh.issues.removeLabel({ ...this.cible(depot), issue_number: numero, name: STATUTS.attente });
      const lancement = `${MARQUEUR_LANCEMENT} par ${login}.`;
      await gh.issues.createComment({ ...this.cible(depot), issue_number: numero, body: lancement });
      // La demande est figée telle que le PO l'a lue : l'agent ne lira jamais l'issue vivante.
      await this.enregistrerLancement(depot, figeeDepuisIssue(issue as Issue, fraiche.type, login), login, lancement);
    } catch (e) {
      traduireErreurGithub(e);
    }
    return { ...fraiche, statut: 'en-cours' };
  }

  /**
   * Change le statut : ADA l'enregistre d'abord (c'est lui qui fait foi), puis recopie le label sur
   * l'issue pour ceux qui la lisent sur GitHub. Une recopie qui échoue ne change rien au travail.
   */
  async changerStatut(jeton: string, depot: string, numero: number, statut: keyof typeof STATUTS): Promise<void> {
    await this.demandes.ecrireStatut(depot, numero, statut);
    const gh = this.github.client(jeton);
    try {
      const { data } = await gh.issues.get({ ...this.cible(depot), issue_number: numero });
      const autres = nomsLabels((data as Issue).labels).filter((l) => !l.startsWith('story:'));
      await assurerLabel(gh, this.cible(depot), STATUTS[statut]);
      await gh.issues.setLabels({ ...this.cible(depot), issue_number: numero, labels: [...autres, STATUTS[statut]] });
    } catch (e) {
      this.journal.warn(`Label de statut de ${depot}#${numero} non recopié sur GitHub : ${(e as Error).message}`);
    }
  }

  /** Demande livrée : plus de statut en cours (l'issue fermée suffit), recopié sur GitHub. */
  async retirerStatut(jeton: string, depot: string, numero: number): Promise<void> {
    await this.demandes.effacerStatut(depot, numero);
    const gh = this.github.client(jeton);
    try {
      const { data } = await gh.issues.get({ ...this.cible(depot), issue_number: numero });
      const garder = nomsLabels((data as Issue).labels).filter((l) => !l.startsWith('story:'));
      await gh.issues.setLabels({ ...this.cible(depot), issue_number: numero, labels: garder });
    } catch (e) {
      this.journal.warn(`Labels de ${depot}#${numero} non retirés sur GitHub : ${(e as Error).message}`);
    }
  }
  /** Découpage validé par le PO (#36) : voir decoupage.ts. */
  creerDecoupage(jeton: string, depot: string, numero: number, saisies: unknown, login: string): Promise<ResumeStory[]> {
    return this.decoupage.creer(jeton, depot, numero, saisies, login);
  }

  /** Story livrée : si elle vient d'un découpage, la cocher dans sa demande parent (voir decoupage.ts). */
  signalerLivraisonAuParent(jeton: string, depot: string, numero: number): Promise<void> {
    return this.decoupage.signalerLivraison(jeton, depot, numero);
  }

  /**
   * Message d'ADA : consigné d'abord dans le journal d'ADA (c'est lui que l'écran et l'agent
   * relisent), puis recopié sur l'issue pour l'équipe, avec le marqueur qui le fait reconnaître.
   */
  async commenterAssistant(jeton: string, depot: string, numero: number, titre: string, texte: string): Promise<void> {
    const corps = `${MARQUEUR_ASSISTANT}\n🤖 **${titre}**\n\n${texte}`;
    await this.demandes.ajouterMessage(depot, numero, { auteur: 'ADA', texte: corps });
    try {
      await this.github.client(jeton).issues.createComment({ ...this.cible(depot), issue_number: numero, body: corps });
    } catch (e) {
      traduireErreurGithub(e);
    }
  }

  /** Message du PO, écrit dans ADA : publié sur l'issue à son nom, puis consigné. Un refus de GitHub ne laisse rien dans le journal. */
  async repondre(jeton: string, depot: string, numero: number, texte: string): Promise<Message> {
    const propre = (texte ?? '').trim();
    if (!propre) throw new BadRequestException({ erreurs: { texte: 'Le message est vide' } });
    try {
      const { data: c } = await this.github.client(jeton).issues.createComment({
        ...this.cible(depot),
        issue_number: numero,
        body: propre,
      });
      await this.demandes.ajouterMessage(depot, numero, { auteur: c.user?.login ?? 'inconnu', texte: propre });
      return { id: c.id, auteur: c.user?.login ?? 'inconnu', avatar: c.user?.avatar_url ?? null, texte: c.body ?? '', le: c.created_at };
    } catch (e) {
      traduireErreurGithub(e);
    }
  }
}
