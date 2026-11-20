/** Activité de l'agent (flux stream-json) traduite en phrases pour le fil du PO. */

const court = (chemin: unknown) => String(chemin ?? '').split('/').slice(-2).join('/');

/** Traduit un événement stream-json de l'agent en phrases pour le fil d'activité. */
export function decrireEvenement(ligne: string): string[] {
  let evt: { type?: string; message?: { content?: { type?: string; name?: string; input?: Record<string, unknown> }[] } };
  try {
    evt = JSON.parse(ligne) as typeof evt;
  } catch {
    return [];
  }
  if (evt.type !== 'assistant') return [];
  return (evt.message?.content ?? [])
    .filter((c) => c.type === 'tool_use')
    .map((c) => {
      const entree = c.input ?? {};
      switch (c.name) {
        case 'Read':
          return `Lit ${court(entree.file_path)}`;
        case 'Edit':
        case 'Write':
          return `Modifie ${court(entree.file_path)}`;
        case 'Glob':
        case 'Grep':
          return 'Parcourt le projet';
        case 'Skill':
          return `Applique la méthode « ${String(entree.skill ?? entree.name ?? 'skill')} »`;
        case 'Bash': {
          const commande = String(entree.command ?? '');
          if (/vitest|test:unit|npm test|test:e2e/.test(commande)) return 'Lance les tests';
          if (/lint|oxlint|eslint/.test(commande)) return 'Vérifie la qualité du code';
          if (/type-check|build/.test(commande)) return 'Vérifie que tout compile';
          if (/prisma/.test(commande)) return 'Met à jour la base de données';
          if (/npm (install|i) /.test(commande)) return 'Installe une dépendance';
          if (/git commit/.test(commande)) return 'Enregistre le travail (commit)';
          if (/^git /.test(commande)) return 'Consulte l’historique';
          return 'Exécute une commande';
        }
        default:
          return `Utilise ${c.name ?? 'un outil'}`;
      }
    });
}
