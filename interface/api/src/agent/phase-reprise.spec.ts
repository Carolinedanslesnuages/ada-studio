import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADA_PAR_DEFAUT } from '../ada/ada-config.js';
import type { AgentService } from './agent.service.js';
import { JETON, preparerBanc, resultat } from './agent.banc.js';

describe('AgentService — reprise d’un projet existant', () => {
  let stories: ReturnType<typeof preparerBanc>['stories'];
  let gh: ReturnType<typeof preparerBanc>['gh'];
  let service: AgentService;
  let lancer: ReturnType<typeof preparerBanc>['lancer'];
  let sortie: string[];
  let statut: string;
  let commits = '1';

  beforeEach(() => {
    statut = 'en-cours';
    commits = '1';
    sortie = [];
    ({ stories, gh, service, lancer } = preparerBanc({ sortie: () => sortie, statut: () => statut, changerStatut: (nouveau) => (statut = nouveau), commits: () => commits }));
  });

  describe('reprise d’un projet existant (#37)', () => {
    const ghReprise = () => {
      const appels = {
        repos: {
          get: vi.fn(async ({ repo }: { repo: string }) => ({ data: { name: repo } })),
          getContent: vi.fn(async () => Promise.reject(Object.assign(new Error('absent'), { status: 404 }))),
        },
        pulls: { list: vi.fn(async () => ({ data: [] })), create: vi.fn(async () => ({ data: { html_url: 'https://github.com/un-po/mon-poc/pull/2' } })) },
        git: {
          getRef: vi.fn(async () => ({ data: { object: { sha: 'sha-main' } } })),
          getCommit: vi.fn(async () => ({ data: { tree: { sha: 'arbre-main' } } })),
          createTree: vi.fn(async () => ({ data: { sha: 'arbre' } })),
          createCommit: vi.fn(async () => ({ data: { sha: 'commit' } })),
          createRef: vi.fn(async () => ({})),
        },
        issues: { update: vi.fn(async () => ({})) },
      };
      Object.assign(gh, appels);
      return appels;
    };
    const ameliorations = [
      { titre: 'Tests d’accessibilité', role: 'PO du projet', besoin: 'un test axe par écran', benefice: 'garantir le RGAA', criteres: ['Chaque écran a son test'] },
      { titre: 'Écrire AGENTS.md', role: 'PO du projet', besoin: 'les règles du projet', benefice: 'guider ADA', criteres: ['Commandes décrites'] },
    ];
    const adaAnalyse = { type: 'service', controles: ['cd /app && npm test'], apercu: { image: 'node:24-bookworm', npm: ['.'], principal: 'npx vite --host 0.0.0.0 --port 5173', port: 5173 } };

    it('analyse en lecture seule comme un projet ADA, ouvre la PR avec l’aperçu déduit, et propose les améliorations', async () => {
      const appels = ghReprise();
      sortie = [resultat(JSON.stringify({ decision: 'reprise', texte: 'Projet Vue sans tests d’accessibilité.', stories: ameliorations, ada: adaAnalyse }))];
      await service.analyserReprise(JETON, 'un-po~mon-poc', 7, 'un-po', { modele: null });
      await service.derniereTache;

      const args = lancer.mock.calls[0]![0];
      expect(args.slice(args.indexOf('--allowedTools') + 1)).toEqual(['Skill', 'Read(./**)', 'Glob(./**)', 'Grep(./**)']);
      expect(args[1]).toContain('Analyse ce projet comme s\'il avait été créé avec ADA');
      expect(args[1]).toContain("garde l'apparence du projet");
      expect(args[1]).toContain('Le PO n’a pas indiqué de stack');

      const arbre = (appels.git.createTree.mock.calls[0] as unknown as [{ tree: { path: string; content: string }[] }])[0].tree;
      const ada = JSON.parse(arbre.find((fichier) => fichier.path === 'ada.json')!.content) as Record<string, unknown>;
      expect(ada).toMatchObject({ edition: 'studio', style: null, composants: null, controles: ['cd /app && npm test'], controlesRequis: ['Titre de PR (Conventional Commits, semver)', 'Taille des fichiers (une responsabilité par fichier)'], apercu: { principal: 'npx vite --host 0.0.0.0 --port 5173' } });
      expect(appels.pulls.create).toHaveBeenCalledWith(expect.objectContaining({ owner: 'un-po', repo: 'mon-poc', head: 'ada/reprise', body: expect.stringContaining('/issues/7') }));

      const [, , , titre, texte] = stories.commenterAssistant!.mock.calls[0] as string[];
      expect(titre).toBe('Analyse de la reprise');
      expect(texte).toContain('https://github.com/un-po/mon-poc/pull/2');
      expect(texte).toContain('ada:decoupage');
      expect(statut).toBe('decoupage');
    });

    it('aperçu inexploitable : reprend celui de la stack indiquée par le PO', async () => {
      const appels = ghReprise();
      sortie = [resultat(JSON.stringify({ decision: 'reprise', texte: 'Bilan.', stories: ameliorations, ada: { apercu: {} } }))];
      await service.analyserReprise(JETON, 'mon-poc', 7, 'un-po', { modele: 'vue-node' });
      await service.derniereTache;
      expect(lancer.mock.calls[0]![0][1]).toContain('Vue 3 + Node.js (Express)');
      const arbre = (appels.git.createTree.mock.calls[0] as unknown as [{ tree: { path: string; content: string }[] }])[0].tree;
      expect(JSON.parse(arbre.find((fichier) => fichier.path === 'ada.json')!.content)).toMatchObject({ edition: 'studio', apercu: { principal: ADA_PAR_DEFAUT.apercu.principal } });
    });

    it('sans aperçu ni stack : pas de PR, un développeur décrit l’aperçu', async () => {
      const appels = ghReprise();
      sortie = [resultat(JSON.stringify({ decision: 'reprise', texte: 'Bilan.', stories: ameliorations }))];
      await service.analyserReprise(JETON, 'mon-poc', 7, 'un-po', { modele: null });
      await service.derniereTache;
      expect(appels.pulls.create).not.toHaveBeenCalled();
      expect(statut).toBe('besoin-dev');
    });

    it('rien à améliorer : bilan, PR de reprise, et la demande d’analyse est close', async () => {
      const appels = ghReprise();
      sortie = [resultat(JSON.stringify({ decision: 'reprise', texte: 'Projet déjà conforme.', stories: [], ada: adaAnalyse }))];
      await service.analyserReprise(JETON, 'mon-poc', 7, 'un-po', { modele: null });
      await service.derniereTache;
      expect(appels.pulls.create).toHaveBeenCalled();
      expect(appels.issues.update).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 7, state: 'closed' }));
    });
  });
});
