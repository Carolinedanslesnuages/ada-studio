import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ADA_PAR_DEFAUT, lireAdaConfig } from '../ada/ada-config.js';
import { attribuerPort, EMPREINTES_NODE, etatDepuisPs, genererCompose, genererScriptDemarrage, genererScriptTravail, NOM_DEPOT, nodeAjoute, PORT_MIN, VERSION_NODE, VOLUME_NODE, volumesPartages } from './apercu.js';

describe('Ports des aperçus', () => {
  it('garde le port déjà attribué à un projet', () => {
    expect(attribuerPort('poc-portail', { 'poc-portail': 5717 })).toBe(5717);
  });

  it('prend le premier port libre', () => {
    expect(attribuerPort('nouveau', { a: PORT_MIN, b: PORT_MIN + 1 })).toBe(PORT_MIN + 2);
  });

  it('refuse quand la plage est pleine', () => {
    const pleins = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`p${i}`, PORT_MIN + i]));
    expect(() => attribuerPort('encore', pleins)).toThrow(/Plus aucun port libre/);
  });
});

describe('Conteneurs d’un aperçu', () => {
  const compose = genererCompose('poc-portail', 5711);

  it('n’expose l’application que sur la machine, sur le port attribué', () => {
    expect(compose).toContain('"127.0.0.1:5711:5173"');
  });

  it('limite la mémoire et le processeur, et isole les dépendances dans des volumes', () => {
    expect(compose).toContain('mem_limit: 1536m');
    expect(compose).toContain('cpus: 1');
    expect(compose).toContain('modules_1:/app/front/node_modules');
    expect(compose).toContain('cache_npm:/home/node/.npm');
    expect(compose).toContain('name: ada-studio-cache-npm');
  });

  it('par défaut (projets existants) : PostgreSQL, API en arrière-plan, front au premier plan', () => {
    expect(compose).toContain('  db:\n    image: postgres:16');
    expect(compose).toContain('DATABASE_URL: postgresql://apercu:apercu@db:5432/apercu?schema=public');
    const travail = genererScriptTravail();
    expect(travail).toContain('--fetch-retries=5');
    expect(travail).toContain('(cd /app/api && installer)');
    expect(travail).toContain('(cd /app/front && installer)');
    expect(travail).toContain('(cd /app/api && npm run start:dev) > /tmp/arriere-plan-0.log 2>&1 &');
    expect(travail).toContain('exec bash -c "cd /app/front && npx vite --host 0.0.0.0 --port 5173 --strictPort"');
    expect(genererScriptDemarrage()).toContain('chown node:node /app/api/node_modules /app/front/node_modules /home/node/.npm');
  });

  it('produit des scripts que bash accepte (par défaut et maquette)', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'scripts-'));
    const maquette = lireAdaConfig(JSON.stringify({ type: 'maquette', edition: 'studio', controlesRequis: ['M'], controles: ['npm test'], apercu: { npm: ['.'], principal: "npx vite --base './'" } }));
    for (const [nom, contenu] of Object.entries({
      'demarrer-defaut.sh': genererScriptDemarrage(),
      'travail-defaut.sh': genererScriptTravail(),
      'demarrer-maquette.sh': genererScriptDemarrage(maquette),
      'travail-maquette.sh': genererScriptTravail(maquette),
    })) {
      writeFileSync(join(dossier, nom), contenu);
      expect(() => execFileSync('bash', ['-n', join(dossier, nom)])).not.toThrow();
    }
  });

  it('un dossier absent dans ada.json (ex. nom de paquet à la place d’un dossier) n’arrête pas l’aperçu', () => {
    // Cas réel : « pip": ["mini-racer"] » écrit par erreur ; l'aperçu plantait en boucle.
    const config = lireAdaConfig(JSON.stringify({ type: 'traitement', edition: 'studio', controlesRequis: ['T'], controles: ['true'], apercu: { image: 'python:3.13-slim', pip: ['mini-racer'], npm: ['absent'], principal: 'true', port: 8000 } }));
    const travail = genererScriptTravail(config);
    expect(travail).toContain('if [ -d /app/mini-racer ]; then (cd /app/mini-racer && installer_python);');
    expect(travail).toContain('if [ -d /app/absent ]; then (cd /app/absent && installer);');
    // Exécution réelle des lignes d'installation (aucun dossier /app ici) : le script continue.
    const lignes = travail.split('\n').filter((ligne) => ligne.startsWith('if [ -d /app/'));
    const sortie = execFileSync('bash', ['-c', ['set -euo pipefail', ...lignes, 'echo suite'].join('\n')], { encoding: 'utf8' });
    expect(sortie).toContain('dossier mini-racer absent : installation ignorée');
    expect(sortie).toContain('dossier absent absent : installation ignorée');
    expect(sortie.trim().endsWith('suite')).toBe(true);
  });

  it('maquette : ni base de données ni API, un seul dossier à la racine', () => {
    const maquette = lireAdaConfig(JSON.stringify({ type: 'maquette', edition: 'studio', controlesRequis: ['M'], controles: ['npm test'], apercu: { npm: ['.'], principal: "cd /app && npx vite --host 0.0.0.0 --port 5173 --strictPort --base './'" } }));
    const fichier = genererCompose('maquette', 5712, maquette);
    expect(fichier).not.toContain('postgres');
    expect(fichier).not.toContain('DATABASE_URL');
    expect(fichier).not.toContain('depends_on');
    expect(fichier).toContain('modules_0:/app/node_modules');
    // Une commande avec des apostrophes ne casse pas le script (chaîne JSON, fichier séparé).
    expect(genererScriptTravail(maquette)).toContain(`exec bash -c "cd /app && npx vite --host 0.0.0.0 --port 5173 --strictPort --base './'"`);
  });

  it('nomme le projet Docker d’après le dépôt', () => {
    expect(compose.startsWith('name: ada-studio-apercu-poc-portail\n')).toBe(true);
  });

  it('n’accepte que des noms de dépôt sûrs', () => {
    expect(NOM_DEPOT.test('poc-portail')).toBe(true);
    expect(NOM_DEPOT.test('../etc')).toBe(false);
    expect(NOM_DEPOT.test('a b')).toBe(false);
  });
});

describe('État d’un aperçu', () => {
  const ligne = (State: string) => JSON.stringify({ Service: 'app', State });

  it('arrêté sans conteneur', () => {
    expect(etatDepuisPs('', false)).toBe('arrete');
  });

  it('en démarrage tant que l’application ne répond pas, prêt ensuite', () => {
    expect(etatDepuisPs(ligne('running'), false)).toBe('demarrage');
    expect(etatDepuisPs(ligne('running'), true)).toBe('pret');
  });

  it('en erreur si le conteneur s’est arrêté', () => {
    expect(etatDepuisPs(`${JSON.stringify({ Service: 'db', State: 'running' })}\n${ligne('exited')}`, false)).toBe('erreur');
  });

  describe('aperçu d’un projet Python', () => {
    const configPython = lireAdaConfig(
      JSON.stringify({
        type: 'api',
        edition: 'studio',
        controlesRequis: ['API'],
        controles: ['cd /app && pytest'],
        apercu: { image: 'python:3.13-slim', base: 'postgres', pip: ['.'], principal: 'cd /app && uvicorn app.main:app --host 0.0.0.0 --port 8000', port: 8000 },
      }),
    );

    it('environnement virtuel conservé, cache pip partagé, et le PATH qui va avec', () => {
      const compose = genererCompose('api-python', 5720, configPython);
      expect(compose).toContain('      - venv:/opt/venv');
      expect(compose).toContain('      - cache_pip:/home/ada/.cache/pip');
      expect(compose).toContain('      PATH: /opt/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin');
      expect(compose).toContain('    name: ada-studio-cache-pip');
      expect(compose).toContain('"127.0.0.1:5720:8000"');
      expect(volumesPartages(configPython)).toEqual(['ada-studio-cache-npm', 'ada-studio-cache-pip']);
      expect(volumesPartages(ADA_PAR_DEFAUT)).toEqual(['ada-studio-cache-npm']);
    });

    it('crée l’utilisateur « ada » (1000, comme « node ») et travaille avec lui, jamais en root', () => {
      const demarrage = genererScriptDemarrage(configPython);
      expect(demarrage).toContain('useradd --create-home --uid 1000 --shell /bin/bash ada');
      expect(demarrage).toContain('chown ada:ada /home/node/.npm /opt/venv /home/ada/.cache/pip');
      expect(demarrage).toContain('exec runuser -u ada -- bash /travail.sh');
      // Les commandes de l'assistant (bash -l) trouvent les outils de l'environnement virtuel.
      expect(demarrage).toContain('/etc/profile.d/ada-venv.sh');
      expect(genererScriptDemarrage(ADA_PAR_DEFAUT)).not.toContain('ada-venv');
      expect(genererScriptDemarrage(ADA_PAR_DEFAUT)).toContain('exec runuser -u node -- bash /travail.sh');
      expect(genererScriptDemarrage(ADA_PAR_DEFAUT)).not.toContain('useradd');
    });

    it('installe les dépendances Python avec nouvelles tentatives, dans l’environnement virtuel', () => {
      const travail = genererScriptTravail(configPython);
      expect(travail).toContain('[ -x /opt/venv/bin/python ] || python3 -m venv /opt/venv');
      expect(travail).toContain('fichier=requirements.txt; [ -f requirements-dev.txt ] && fichier=requirements-dev.txt');
      expect(travail).toContain('pip install --retries 5 --timeout 60 -r "$fichier"');
      expect(travail).toContain('(cd /app && installer_python)');
      expect(genererScriptTravail(ADA_PAR_DEFAUT)).not.toContain('pip install');
    });

    it('scripts générés syntaxiquement valides (bash -n)', () => {
      for (const script of [genererScriptDemarrage(configPython), genererScriptTravail(configPython)]) {
        expect(() => execFileSync('bash', ['-n'], { input: script })).not.toThrow();
      }
    });
  });
});

describe('Node ajouté à une image Python (Vue + FastAPI)', () => {
  const pythonEtVue = { ...ADA_PAR_DEFAUT, apercu: { ...ADA_PAR_DEFAUT.apercu, image: 'python:3.13-slim', npm: ['front'], pip: ['api'] } };

  it('seulement quand l’image n’a pas Node et que le projet a des dépendances npm', () => {
    expect(nodeAjoute(pythonEtVue)).toBe(true);
    expect(nodeAjoute(ADA_PAR_DEFAUT)).toBe(false);
    expect(nodeAjoute({ ...pythonEtVue, apercu: { ...pythonEtVue.apercu, npm: [] } })).toBe(false);
  });

  it('version figée, empreinte vérifiée avant extraction, téléchargée une fois dans un volume partagé', () => {
    const script = genererScriptDemarrage(pythonEtVue);
    expect(script).toContain(`node-v${VERSION_NODE}-linux-`);
    expect(script).toContain(EMPREINTES_NODE.x64);
    expect(script).toContain('if [ ! -x /opt/node/bin/node ]; then');
    expect(script.indexOf('hashlib.sha256')).toBeLessThan(script.indexOf('extractall'));
    expect(volumesPartages(pythonEtVue)).toContain(VOLUME_NODE);
    const compose = genererCompose('poc', 5710, pythonEtVue);
    expect(compose).toContain('PATH: /opt/venv/bin:/opt/node/bin:');
    expect(compose).toContain('- node:/opt/node');
    expect(compose).toContain('npm_config_cache: /home/node/.npm');
  });

  it('une image Node reste inchangée', () => {
    expect(genererScriptDemarrage(ADA_PAR_DEFAUT)).not.toContain('/opt/node');
    expect(genererCompose('poc', 5710, ADA_PAR_DEFAUT)).not.toContain('/opt/node');
  });
});
