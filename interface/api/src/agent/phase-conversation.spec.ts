import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lireDecoupage } from '../stories/story.js';
import type { AgentService } from './agent.service.js';
import { detailEssai, type FauxApercu, JETON, preparerBanc, resultat } from './agent.banc.js';

describe('AgentService — conversation', () => {
  let stories: ReturnType<typeof preparerBanc>['stories'];
  let apercu: FauxApercu;
  let gh: ReturnType<typeof preparerBanc>['gh'];
  let service: AgentService;
  let lancer: ReturnType<typeof preparerBanc>['lancer'];
  let sortie: string[];
  let statut: string;
  let commits = '1';
  const detail = () => detailEssai(statut);

  beforeEach(() => {
    statut = 'en-cours';
    commits = '1';
    sortie = [];
    ({ stories, apercu, gh, service, lancer } = preparerBanc({ sortie: () => sortie, statut: () => statut, changerStatut: (nouveau) => (statut = nouveau), commits: () => commits }));
  });

  describe('conversation (« vrai prompt »)', () => {
    const conversation = () => ({
      ...detail(),
      type: 'conversation',
      titre: 'Conversation : mets le titre en bleu',
      statut,
      contenu: null,
      contenuLibre: 'Mets le titre en bleu',
      messages: [{ id: 2, auteur: 'po', texte: '▶️ Lancée depuis ADA par po1 (conversation).', le: '' }],
    });
    beforeEach(() => {
      stories.detail = vi.fn(async () => conversation());
      stories.fermerSansSuite = vi.fn(async () => undefined);
      apercu.executer = vi.fn(async (_c: string, args: string[]) => ({
        stdout: args.includes('rev-list') ? `${commits}\n` : args.includes('branch') ? '  conversation/1-mets-le-titre-en-bleu\n' : args.includes('rev-parse') ? 'main\n' : '',
      }));
    });

    it('agit tout de suite sur sa branche, pousse les commits, relance l’aperçu et répond', async () => {
      sortie = [resultat('{"reponse":"C’est fait : le titre est bleu."}')];
      await service.converser(JETON, 'po1', 'poc', 1);
      await service.derniereTache;
      const args = lancer.mock.calls[0]![0];
      expect(args.slice(args.indexOf('--allowedTools') + 1)).toContain('Edit(./**)');
      expect(args[1]).toContain('PHASE : CONVERSATION');
      expect(args[1]).toContain('Premier message du PO :\nMets le titre en bleu');
      const appels = apercu.executer.mock.calls.map((appel) => (appel[1] as string[]).join(' '));
      expect(appels.some((appel) => appel.startsWith('-C') && appel.includes('checkout --quiet conversation/1-mets-le-titre-en-bleu'))).toBe(true);
      expect(appels.some((appel) => appel.includes('push --quiet -u origin conversation/1-mets-le-titre-en-bleu'))).toBe(true);
      expect(appels.some((appel) => appel.includes('main') && appel.includes('push') && !appel.includes('conversation/'))).toBe(false);
      expect(apercu.relancerApplication).toHaveBeenCalledWith('poc');
      expect(stories.commenterAssistant).toHaveBeenCalledWith(JETON, 'poc', 1, 'ADA', 'C’est fait : le titre est bleu.');
      expect(statut).toBe('echange');
      expect(gh.pulls.create).not.toHaveBeenCalled();
    });

    it('une simple question : réponse sans rien pousser', async () => {
      commits = '0';
      sortie = [resultat('{"reponse":"Le titre est dans l’en-tête."}')];
      await service.converser(JETON, 'po1', 'poc', 1);
      await service.derniereTache;
      const appels = apercu.executer.mock.calls.map((appel) => (appel[1] as string[]).join(' '));
      expect(appels.some((appel) => appel.includes('push'))).toBe(false);
      expect(statut).toBe('echange');
    });

    it('sait qu’elle n’a aucun accès à GitHub ; les stories pour plus tard qu’elle propose arrivent à choisir dans ADA', async () => {
      commits = '0';
      const proposee = { titre: 'Envoyer les tirages', role: 'organisateur', besoin: 'envoyer les tirages par e-mail', benefice: 'prévenir chacun', criteres: ['Un e-mail par participant'] };
      sortie = [resultat(JSON.stringify({ reponse: 'Voici une story pour plus tard.', stories: [proposee] }))];
      await service.converser(JETON, 'po1', 'poc', 1);
      await service.derniereTache;
      const consigne = lancer.mock.calls[0]![0][1]!;
      expect(consigne).toContain('Tu n\'as AUCUN accès à GitHub');
      expect(consigne).toContain('"stories":[{"titre"');
      const message = stories.commenterAssistant.mock.calls[0]![4] as string;
      expect(message).toContain('Voici une story pour plus tard.');
      expect(message).toContain('**Envoyer les tirages**');
      expect(lireDecoupage(message)).toEqual([proposee]);
      expect(statut).toBe('echange'); // la conversation continue
    });

    it('un message du PO relance ADA ; refusé si ADA n’attend rien', async () => {
      statut = 'echange';
      sortie = [resultat('{"reponse":"Voilà."}')];
      await service.reprendreConversation(JETON, 'po1', 'poc', 1, 'plutôt en rouge');
      await service.derniereTache;
      expect(stories.repondre).toHaveBeenCalledWith(JETON, 'poc', 1, 'plutôt en rouge');
      expect(lancer).toHaveBeenCalledTimes(1);
      statut = 'en-cours';
      await expect(service.reprendreConversation(JETON, 'po1', 'poc', 1, 'encore')).rejects.toThrow(/n’attend pas de message/);
      statut = 'echange';
      await expect(service.reprendreConversation(JETON, 'po1', 'poc', 1, '  ')).rejects.toThrow(/Écrivez votre message/);
    });

    it('garde le fil : le message suivant reprend la session de l’agent, avec une consigne courte', async () => {
      sortie = [resultat('{"reponse":"Titre en bleu."}')];
      await service.converser(JETON, 'po1', 'poc', 1);
      await service.derniereTache;
      const premier = lancer.mock.calls[0]![0];
      const session = premier[premier.indexOf('--session-id') + 1]!;
      expect(session).toMatch(/^[0-9a-f-]{36}$/);
      expect(premier).not.toContain('--no-session-persistence');
      expect(premier[1]).toContain('PHASE : CONVERSATION');
      expect(premier[1]).toContain('lance SEULEMENT les tests liés');

      stories.detail = vi.fn(async () => ({ ...conversation(), messages: [...conversation().messages, { id: 3, auteur: 'po', texte: 'Plutôt en rouge', le: '' }] }));
      sortie = [resultat('{"reponse":"Titre en rouge."}')];
      await service.converser(JETON, 'po1', 'poc', 1);
      await service.derniereTache;
      const second = lancer.mock.calls[1]![0];
      expect(second.slice(second.indexOf('--resume'), second.indexOf('--resume') + 2)).toEqual(['--resume', session]);
      expect(second[1]).toContain('Nouveau message du PO :\nPlutôt en rouge');
      expect(second[1]).not.toContain('PHASE : CONVERSATION');
      expect(stories.commenterAssistant).toHaveBeenLastCalledWith(JETON, 'poc', 1, 'ADA', 'Titre en rouge.');
    });

    it('session introuvable : repart de la consigne complète, dans une nouvelle session', async () => {
      sortie = [resultat('{"reponse":"Un."}')];
      await service.converser(JETON, 'po1', 'poc', 1);
      await service.derniereTache;
      stories.detail = vi.fn(async () => ({ ...conversation(), messages: [...conversation().messages, { id: 3, auteur: 'po', texte: 'Encore', le: '' }] }));
      let appel = 0;
      lancer.mockImplementation(async (_args, _cwd, surLigne) => {
        appel++;
        if (appel === 1) return 1; // la reprise échoue
        surLigne(resultat('{"reponse":"Deux."}'));
        return 0;
      });
      await service.converser(JETON, 'po1', 'poc', 1);
      await service.derniereTache;
      const repli = lancer.mock.calls.at(-1)![0];
      expect(repli).toContain('--session-id');
      expect(repli[1]).toContain('PHASE : CONVERSATION');
      expect(stories.commenterAssistant).toHaveBeenLastCalledWith(JETON, 'poc', 1, 'ADA', 'Deux.');
    });

    it('« c’est bon » : ADA lance les contrôles complets, puis la PR s’ouvre et la demande passe à vérifier', async () => {
      statut = 'echange';
      sortie = [resultat('{"reponse":"Le titre est bleu et plus grand.","pret":true}')];
      await service.terminerConversation(JETON, 'po1', 'poc', 1);
      await service.derniereTache;
      expect(stories.repondre).toHaveBeenCalledWith(JETON, 'poc', 1, expect.stringContaining('C’est bon'));
      expect(lancer.mock.calls[0]![0][1]).toContain('LE PO A DIT « C\'EST BON »');
      expect(gh.pulls.create).toHaveBeenCalledWith(expect.objectContaining({ head: 'conversation/1-mets-le-titre-en-bleu', base: 'main', title: 'feat: mets le titre en bleu' }));
      expect(stories.commenterAssistant).toHaveBeenCalledWith(JETON, 'poc', 1, 'Changements proposés au projet', expect.stringContaining('Le titre est bleu et plus grand.'));
      expect(statut).toBe('en-verification');
    });

    it('« c’est bon » mais un contrôle reste en échec : pas de PR, ADA le dit, la conversation continue', async () => {
      statut = 'echange';
      sortie = [resultat('{"reponse":"Le test de la page d’accueil échoue encore.","pret":false}')];
      await service.terminerConversation(JETON, 'po1', 'poc', 1);
      await service.derniereTache;
      expect(gh.pulls.create).not.toHaveBeenCalled();
      expect(stories.commenterAssistant).toHaveBeenCalledWith(JETON, 'poc', 1, 'Pas encore prêt', expect.stringContaining('échoue encore'));
      expect(statut).toBe('echange');
    });

    it('« c’est bon » sans aucun changement : la conversation se ferme, sans PR', async () => {
      statut = 'echange';
      commits = '0';
      sortie = [resultat('{"reponse":"Rien à changer.","pret":true}')];
      await service.terminerConversation(JETON, 'po1', 'poc', 1);
      await service.derniereTache;
      expect(gh.pulls.create).not.toHaveBeenCalled();
      expect(stories.fermerSansSuite).toHaveBeenCalledWith(JETON, 'poc', 1, expect.stringContaining('sans changement'));
    });

    it('arrêter : rien n’est ajouté au projet', async () => {
      statut = 'echange';
      await service.arreterConversation(JETON, 'po1', 'poc', 1);
      expect(stories.fermerSansSuite).toHaveBeenCalledWith(JETON, 'poc', 1, expect.stringContaining('rien n’est ajouté au projet'));
      expect(gh.pulls.create).not.toHaveBeenCalled();
    });
  });
});
