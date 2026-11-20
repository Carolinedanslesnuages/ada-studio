/**
 * Découpage d'une demande (#36) : les stories validées par le PO sont publiées à son nom, la
 * demande d'origine devient leur parent, et se ferme quand toutes sont livrées.
 */
import { ConflictException } from '@nestjs/common';
import { traduireErreurGithub } from '../github/erreurs.js';
import type { GithubService } from '../github/github.service.js';
import type { CibleDepot } from '../projets/depot.js';
import type { DemandesStore } from './demandes.js';
import { assurerLabel } from './labels.js';
import { resumer, type Issue, type ResumeStory } from './resume-story.js';
import type { StoriesService } from './stories.service.js';
import { ajouterDecoupage, cocherEnfant, formaterStory, LABEL_STORY, lireParent, MARQUEUR_DECOUPAGE, validerStoriesAPublier } from './story.js';

export class Decoupage {
  constructor(
    private readonly stories: Pick<StoriesService, 'detail' | 'changerStatut' | 'retirerStatut'>,
    private readonly github: GithubService,
    private readonly demandes: DemandesStore,
    private readonly cible: (depot: string) => CibleDepot,
  ) {}

  /**
   * Découpage validé par le PO (#36) : ADA publie, à son nom, les stories qu'il a cochées — telles
   * qu'il les a relues et éventuellement corrigées (champs préremplis par l'assistant) — et la
   * demande d'origine devient leur parent (liste à cocher, fermée quand toutes sont livrées).
   * En conversation, les stories proposées par ADA sont publiées sans parent : la conversation continue.
   */
  async creer(jeton: string, depot: string, numero: number, saisies: unknown, login: string): Promise<ResumeStory[]> {
    const parent = await this.stories.detail(jeton, depot, numero);
    // Conversation : des stories proposées par ADA dans son dernier message (la conversation continue).
    const enConversation = parent.type === 'conversation';
    if (enConversation) {
      const dernier = parent.messages.at(-1);
      if (parent.statut !== 'echange' || !dernier?.texte.includes(MARQUEUR_DECOUPAGE)) {
        throw new ConflictException('Aucune story proposée par ADA n’attend votre choix dans cette conversation');
      }
    } else if (parent.statut !== 'decoupage') throw new ConflictException('Aucun découpage n’attend votre choix sur cette demande');
    const stories = validerStoriesAPublier(saisies);
    const gh = this.github.client(jeton);
    const creees: ResumeStory[] = [];
    try {
      await assurerLabel(gh, this.cible(depot), LABEL_STORY);
      for (const story of stories) {
        const { data } = await gh.issues.create({
          ...this.cible(depot),
          title: story.titre,
          body: formaterStory(story, numero, enConversation ? 'conversation' : 'decoupage'),
          labels: [LABEL_STORY],
        });
        creees.push(resumer(data as Issue, true, 'nouvelle'));
      }
      if (enConversation) {
        const notice = `📝 Stories publiées par ${login} : ${creees.map((story) => `#${story.numero}`).join(', ')}, créées depuis ADA à partir de la conversation.`;
        await this.demandes.ajouterMessage(depot, numero, { auteur: login, texte: notice });
        await gh.issues.createComment({ ...this.cible(depot), issue_number: numero, body: notice });
        return creees;
      }
      const { data: issueParent } = await gh.issues.get({ ...this.cible(depot), issue_number: numero });
      await gh.issues.update({
        ...this.cible(depot),
        issue_number: numero,
        body: ajouterDecoupage(issueParent.body ?? '', creees.map((story) => ({ numero: story.numero, titre: story.titre }))),
      });
      const notice = `✂️ Découpage validé par ${login} : ${creees.map((story) => `#${story.numero}`).join(', ')} créées depuis ADA.`;
      await this.demandes.ajouterMessage(depot, numero, { auteur: login, texte: notice });
      await gh.issues.createComment({ ...this.cible(depot), issue_number: numero, body: notice });
      await this.stories.changerStatut(jeton, depot, numero, 'parent');
    } catch (e) {
      traduireErreurGithub(e);
    }
    return creees;
  }

  /** Story livrée : si elle vient d'un découpage, la cocher dans sa demande parent, fermée quand tout est livré. */
  async signalerLivraison(jeton: string, depot: string, numero: number): Promise<void> {
    const gh = this.github.client(jeton);
    try {
      const { data: enfant } = await gh.issues.get({ ...this.cible(depot), issue_number: numero });
      const numeroParent = lireParent(enfant.body ?? '');
      if (!numeroParent) return;
      const { data: parent } = await gh.issues.get({ ...this.cible(depot), issue_number: numeroParent });
      const { corps, toutesLivrees } = cocherEnfant(parent.body ?? '', numero);
      if (corps !== parent.body) await gh.issues.update({ ...this.cible(depot), issue_number: numeroParent, body: corps });
      if (toutesLivrees && parent.state === 'open') {
        const notice = '✅ Toutes les stories du découpage sont livrées.';
        await this.demandes.ajouterMessage(depot, numeroParent, { auteur: 'ADA', texte: notice });
        await gh.issues.createComment({ ...this.cible(depot), issue_number: numeroParent, body: notice });
        await gh.issues.update({ ...this.cible(depot), issue_number: numeroParent, state: 'closed', state_reason: 'completed' });
        await this.stories.retirerStatut(jeton, depot, numeroParent);
      }
    } catch (e) {
      traduireErreurGithub(e);
    }
  }
}
