import { ADA_PAR_DEFAUT, type AdaConfig } from '../ada/ada-config.js';
import { nomTechnique } from '../projets/depot.js';

/** Fichiers et règles de l'aperçu d'un projet : fonctions pures, testées sans Docker. */

/**
 * Ports d'ADA studio : plage 5700-5899, distincte de celle de l'ADA du travail (5180, 3100, 5300-5499).
 * 5700 interface, 5701 API, 5702 Storybook de l'interface ; puis les aperçus, leurs Storybook et les démos.
 */
export const PORT_MIN = 5710;
export const PORT_MAX = 5769;
/** Storybook de l'aperçu (onglet « Composants ») : une plage à part. */
export const PLAGE_COMPOSANTS = { min: 5770, max: 5829 };
/** Liens de démonstration : une autre plage, pour ne jamais confondre démo et aperçu de travail. */
export const PLAGE_DEMO = { min: 5830, max: 5899 };
export { NOM_DEPOT } from '../projets/depot.js';

/** Cache npm commun à tous les aperçus (créé une fois) : seuls les premiers téléchargements sont lents. */
export const VOLUME_CACHE_NPM = 'ada-studio-cache-npm';
/** Cache pip commun aux aperçus Python (créé une fois). */
export const VOLUME_CACHE_PIP = 'ada-studio-cache-pip';

/**
 * Node ajouté aux images qui n'en ont pas (Python + Vue) : version figée, empreintes officielles
 * (nodejs.org/dist/v24.11.0/SHASUMS256.txt) vérifiées, téléchargée une fois dans un volume partagé.
 */
export const VERSION_NODE = '24.11.0';
export const EMPREINTES_NODE: Record<string, string> = {
  x64: 'b3c071cdf47aab867c3b2aa287257df12ec5d7c962bf922b32fd33226c4295fd',
  arm64: '4786d00c4d259d3ff0b2328307f764ef3ced65f2d6e9502d433e68d66238509d',
};
export const VOLUME_NODE = `ada-studio-node-${VERSION_NODE}`;

/** Volumes partagés entre aperçus, à créer avant le premier démarrage. */
export const volumesPartages = (config: AdaConfig): string[] => [
  VOLUME_CACHE_NPM,
  ...(config.apercu.pip.length ? [VOLUME_CACHE_PIP] : []),
  ...(nodeAjoute(config) ? [VOLUME_NODE] : []),
];

/**
 * Les images Node ont l'utilisateur « node » (1000) ; les autres (Python…) reçoivent « ada », avec
 * le même numéro 1000 : l'assistant travaille dans tout aperçu avec `-u 1000`.
 */
const imageNode = (config: AdaConfig) => config.apercu.image.startsWith('node:');
const MAISON_PYTHON = '/home/ada';
/** Image sans Node (Python…) mais des dépendances npm (un front Vue) : ADA y ajoute Node. */
export const nodeAjoute = (config: AdaConfig) => !imageNode(config) && config.apercu.npm.length > 0;

/** Téléchargement de Node par Python (présent dans l'image), empreinte vérifiée avant extraction. */
const installationNode = () => {
  const empreintes = JSON.stringify(EMPREINTES_NODE);
  return [
    'if [ ! -x /opt/node/bin/node ]; then',
    `  echo "[apercu] installation de Node ${VERSION_NODE}"`,
    "  python3 - <<'PYTHON'",
    'import hashlib, json, platform, shutil, tarfile, urllib.request',
    `empreintes = json.loads('${empreintes}')`,
    "architecture = {'x86_64': 'x64', 'aarch64': 'arm64', 'arm64': 'arm64'}[platform.machine()]",
    `nom = f'node-v${VERSION_NODE}-linux-{architecture}'`,
    `contenu = urllib.request.urlopen(f'https://nodejs.org/dist/v${VERSION_NODE}/{nom}.tar.gz', timeout=600).read()`,
    "if hashlib.sha256(contenu).hexdigest() != empreintes[architecture]:",
    "    raise SystemExit('Empreinte de Node invalide : installation refusée')",
    "open('/tmp/node.tar.gz', 'wb').write(contenu)",
    "with tarfile.open('/tmp/node.tar.gz') as archive:",
    "    archive.extractall('/tmp', filter='data')",
    "shutil.copytree(f'/tmp/{nom}', '/opt/node', symlinks=True, dirs_exist_ok=True)",
    'PYTHON',
    'fi',
  ];
};

/** Premier port libre de la plage, ou celui déjà attribué au projet. */
export function attribuerPort(
  projet: string,
  attribues: Record<string, number>,
  plage: { min: number; max: number } = { min: PORT_MIN, max: PORT_MAX },
): number {
  if (attribues[projet]) return attribues[projet];
  const pris = new Set(Object.values(attribues));
  for (let port = plage.min; port <= plage.max; port++) if (!pris.has(port)) return port;
  throw new Error('Plus aucun port libre pour un aperçu : arrêtez des aperçus inutilisés');
}

/** Port de Storybook dans le conteneur de l'aperçu (onglet « Composants »). */
export const PORT_STORYBOOK = 6006;

/** Commande qui lance le Storybook du projet dans le conteneur (dossier du front déclaré par ada.json). */
export function commandeComposants(config: AdaConfig): string | null {
  if (!config.interface) return null;
  return `cd ${cheminDossier(config.interface.dossier)} && exec npx storybook dev -p ${PORT_STORYBOOK} --host 0.0.0.0 --exact-port --ci --no-open`;
}

export const cheminDossier = (dossier: string) => (dossier === '.' ? '/app' : `/app/${dossier.replace(/^\.\//, '')}`);

/**
 * Conteneurs de l'aperçu, d'après ada.json : l'application, plus PostgreSQL si le modèle en a
 * besoin. Limités en mémoire et processeur ; dépendances dans des volumes (binaires Linux).
 */
export function genererCompose(
  projet: string,
  port: number,
  config: AdaConfig = ADA_PAR_DEFAUT,
  options: { nom?: string; hotesAutorises?: string[]; portComposants?: number } = {},
): string {
  const { apercu } = config;
  const hotes = (options.hotesAutorises ?? []).filter((hote) => /^[a-z0-9.-]+$/i.test(hote));
  const volumesModules = apercu.npm.map((dossier, index) => `      - modules_${index}:${cheminDossier(dossier)}/node_modules`);
  const base = apercu.base === 'postgres';
  const lignes = [
    `name: ${nomTechnique(`ada-studio-${options.nom ?? `apercu-${projet}`}`)}`,
    'services:',
    ...(base
      ? [
          '  db:',
          '    image: postgres:16',
          '    environment:',
          '      POSTGRES_USER: apercu',
          '      POSTGRES_PASSWORD: apercu',
          '      POSTGRES_DB: apercu',
          '    volumes:',
          '      - donnees:/var/lib/postgresql/data',
          '    healthcheck:',
          '      test: ["CMD-SHELL", "pg_isready -U apercu"]',
          '      interval: 3s',
          '      retries: 20',
          '    mem_limit: 256m',
        ]
      : []),
    '  app:',
    `    image: ${apercu.image}`,
    '    working_dir: /app',
    '    environment:',
    ...(base ? ['      DATABASE_URL: postgresql://apercu:apercu@db:5432/apercu?schema=public'] : []),
    '      NODE_ENV: development',
    ...(apercu.pip.length || nodeAjoute(config)
      ? [`      PATH: ${[...(apercu.pip.length ? ['/opt/venv/bin'] : []), ...(nodeAjoute(config) ? ['/opt/node/bin'] : []), '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'].join(':')}`]
      : []),
    // Cache npm partagé, au même endroit quel que soit l'utilisateur (node ou ada).
    ...(nodeAjoute(config) ? ['      npm_config_cache: /home/node/.npm'] : []),
    ...(apercu.pip.length
      ? [
          '      VIRTUAL_ENV: /opt/venv',
          '      PIP_DISABLE_PIP_VERSION_CHECK: "1"',
          '      PYTHONDONTWRITEBYTECODE: "1"',
          '      PYTHONUNBUFFERED: "1"',
        ]
      : []),
    // Adresse publique (lien de démonstration) : le serveur de Vite refuse sinon un autre hôte.
    ...(hotes.length ? [`      __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: ${hotes.join(',')}`] : []),
    '    volumes:',
    '      - ./depot:/app',
    '      - ./demarrer.sh:/demarrer.sh:ro',
    '      - ./travail.sh:/travail.sh:ro',
    ...volumesModules,
    '      - cache_npm:/home/node/.npm',
    ...(apercu.pip.length ? ['      - venv:/opt/venv', `      - cache_pip:${MAISON_PYTHON}/.cache/pip`] : []),
    ...(nodeAjoute(config) ? ['      - node:/opt/node'] : []),
    '    command: ["bash", "/demarrer.sh"]',
    '    ports:',
    `      - "127.0.0.1:${port}:${apercu.port}"`,
    ...(options.portComposants && config.interface ? [`      - "127.0.0.1:${options.portComposants}:${PORT_STORYBOOK}"`] : []),
    ...(base ? ['    depends_on:', '      db:', '        condition: service_healthy'] : []),
    '    mem_limit: 1536m',
    '    cpus: 1',
    'volumes:',
    ...(base ? ['  donnees: {}'] : []),
    ...apercu.npm.map((_, index) => `  modules_${index}: {}`),
    '  cache_npm:',
    `    name: ${VOLUME_CACHE_NPM}`,
    '    external: true',
    ...(apercu.pip.length ? ['  venv: {}', '  cache_pip:', `    name: ${VOLUME_CACHE_PIP}`, '    external: true'] : []),
    ...(nodeAjoute(config) ? ['  node:', `    name: ${VOLUME_NODE}`, '    external: true'] : []),
  ];
  return `${lignes.join('\n')}\n`;
}

/**
 * Lancé en root uniquement pour donner les volumes à l'utilisateur « node » (images Node), puis
 * travail.sh tourne en « node ». npm install (et non npm ci) : npm ci voudrait supprimer le point
 * de montage.
 */
export function genererScriptDemarrage(config: AdaConfig = ADA_PAR_DEFAUT): string {
  const volumes = [
    ...config.apercu.npm.map((dossier) => `${cheminDossier(dossier)}/node_modules`),
    '/home/node/.npm',
    ...(config.apercu.pip.length ? ['/opt/venv', `${MAISON_PYTHON}/.cache/pip`] : []),
  ];
  const utilisateur = imageNode(config) ? 'node' : 'ada';
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    // Image sans utilisateur « node » (Python…) : on crée « ada », numéro 1000, comme « node ».
    ...(imageNode(config) ? [] : ['id -u ada >/dev/null 2>&1 || useradd --create-home --uid 1000 --shell /bin/bash ada']),
    // Les commandes de l'assistant passent par un shell de connexion (bash -l), qui refait le PATH :
    // l'environnement virtuel Python y est déclaré, sinon pytest, ruff… sont introuvables.
    ...(config.apercu.pip.length
      ? [`printf 'export VIRTUAL_ENV=/opt/venv\\nexport PATH=/opt/venv/bin:$PATH\\n' > /etc/profile.d/ada-venv.sh`]
      : []),
    ...(nodeAjoute(config)
      ? [...installationNode(), `printf 'export PATH=/opt/node/bin:$PATH\\nexport npm_config_cache=/home/node/.npm\\n' > /etc/profile.d/ada-node.sh`]
      : []),
    `mkdir -p ${volumes.join(' ')}`,
    `chown ${utilisateur}:${utilisateur} ${volumes.join(' ')}`,
    `exec runuser -u ${utilisateur} -- bash /travail.sh`,
    '',
  ].join('\n');
}

/**
 * Installation dans un dossier déclaré par ada.json. Un dossier absent (ex. un nom de paquet mis
 * par erreur à la place d'un dossier) est signalé et ignoré : il ne doit pas arrêter tout l'aperçu.
 */
const installerDans = (dossier: string, fonction: string, libelle: string): string[] => [
  `echo "[apercu] installation${libelle} : ${dossier}"`,
  `if [ -d ${cheminDossier(dossier)} ]; then (cd ${cheminDossier(dossier)} && ${fonction}); else echo "[apercu] dossier ${dossier} absent : installation ignorée (à corriger dans ada.json, qui attend des dossiers)"; fi`,
];

/** Installation (avec nouvelles tentatives sur connexion lente), préalables, arrière-plan, page affichée. */
export function genererScriptTravail(config: AdaConfig = ADA_PAR_DEFAUT): string {
  const { apercu } = config;
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'installer() {',
    '  for essai in 1 2 3; do',
    '    npm install --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 \\',
    '      --fetch-retry-maxtimeout=180000 --fetch-timeout=600000 && return 0',
    '    echo "[apercu] installation interrompue (essai $essai), nouvelle tentative"',
    '    sleep 10',
    '  done',
    '  return 1',
    '}',
    ...apercu.npm.flatMap((dossier) => installerDans(dossier, 'installer', '')),
    ...(apercu.pip.length
      ? [
          'installer_python() {',
          '  for essai in 1 2 3; do',
          // Outils de test et de lint compris (requirements-dev.txt inclut requirements.txt) : l'assistant
          // lance ses contrôles dans l'aperçu.
          '    fichier=requirements.txt; [ -f requirements-dev.txt ] && fichier=requirements-dev.txt',
          '    pip install --retries 5 --timeout 60 -r "$fichier" && return 0',
          '    echo "[apercu] installation Python interrompue (essai $essai), nouvelle tentative"',
          '    sleep 10',
          '  done',
          '  return 1',
          '}',
          '[ -x /opt/venv/bin/python ] || python3 -m venv /opt/venv',
          ...apercu.pip.flatMap((dossier) => installerDans(dossier, 'installer_python', ' Python')),
        ]
      : []),
    ...apercu.avant,
    ...apercu.arrierePlan.map((commande, index) => `(${commande}) > /tmp/arriere-plan-${index}.log 2>&1 &`),
    'echo "[apercu] demarrage"',
    `exec bash -c ${JSON.stringify(apercu.principal)}`,
    '',
  ].join('\n');
}

export type EtatApercu = 'arrete' | 'demarrage' | 'pret' | 'erreur';

/** Déduit l'état à partir de `docker compose ps --format json` (une ligne JSON par conteneur). */
export function etatDepuisPs(sortie: string, repond: boolean): EtatApercu {
  const conteneurs = sortie
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { Service?: string; State?: string });
  const app = conteneurs.find((c) => c.Service === 'app');
  if (!app) return 'arrete';
  if (app.State === 'running') return repond ? 'pret' : 'demarrage';
  if (app.State === 'created' || app.State === 'restarting') return 'demarrage';
  return 'erreur';
}

/**
 * Adresse publique d'un lien de démonstration, d'après le modèle `URL_DEMO` : `{projet}` et
 * `{port}` y sont remplacés (ex. https://{projet}.demo.ada.gouv.fr, ou http://localhost:{port}).
 */
export function adresseDemo(modele: string, projet: string, port: number): string {
  return modele.replaceAll('{projet}', nomTechnique(projet)).replaceAll('{port}', String(port));
}
