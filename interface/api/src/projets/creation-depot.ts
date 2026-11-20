/** Étapes de la création d'un projet sur GitHub : dépôt vide, copie du modèle poussée, idée de départ. */
import { ForbiddenException } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Octokit } from '@octokit/rest';
import type { Executer } from '../apercu/apercu.service.js';
import { decrireErreurGithub } from '../github/erreurs.js';
import { formaterPrompt, LABEL_LIBRE, MARQUEUR_LANCEMENT, STATUTS, titrePrompt } from '../stories/story.js';
import { personnaliser, type ValeursProjet } from './projet.js';
import { ajouterSkillsPo } from './skills-projet.js';
import type { Composants, Style } from '../ada/ada-config.js';
import { appliquerVariantes } from '../variantes/combinaisons.js';
import type { DepotGithub } from './projets.service.js';

const statut = (e: unknown) => (e as { status?: number }).status;

/**
 * L'idée racontée à la création devient la première demande libre du projet, lancée aussitôt (#68) :
 * l'assistant pose ses questions puis propose l'objectif et les premières stories (découpage),
 * que le PO valide. Un échec ici ne défait pas la création : le PO pourra « Prompter » son idée.
 */
export async function enregistrerIdee(gh: Octokit, owner: string, repo: string, idee: string, login: string, avertir: (message: string) => void): Promise<number | null> {
  try {
    const { data } = await gh.issues.create({
      owner,
      repo,
      title: titrePrompt(idee),
      body: formaterPrompt(idee),
      labels: [LABEL_LIBRE, STATUTS['en-cours']],
    });
    await gh.issues.createComment({ owner, repo, issue_number: data.number, body: `${MARQUEUR_LANCEMENT} par ${login} (idée de départ du projet).` });
    return data.number;
  } catch (e) {
    avertir(`Idée de départ non enregistrée dans ${owner}/${repo} : ${decrireErreurGithub(e)}`);
    return null;
  }
}

/** Dépôt vide sur le compte de la personne connectée, privé ou public selon son choix. */
export async function creerDepotVide(gh: Octokit, slug: string, description: string, prive: boolean, avertir: (message: string) => void): Promise<DepotGithub> {
  const parametres = { name: slug, description, private: prive, auto_init: false };
  try {
    const { data } = await gh.repos.createForAuthenticatedUser(parametres);
    return data;
  } catch (e) {
    if (statut(e) === 404 || statut(e) === 403) {
      avertir(`Création de dépôt refusée : ${decrireErreurGithub(e)}`);
      throw new ForbiddenException(
        'L’application GitHub d’ADA ne peut pas créer de dépôt sur votre compte. ' +
          'Installez-la sur votre compte GitHub (page de l’application → Install → votre compte → « All repositories »), ' +
          'ou, si elle l’est déjà, acceptez les permissions demandées s’il y a une demande en attente.',
      );
    }
    throw e;
  }
}

/**
 * Copie du modèle (fichiers suivis par git uniquement : ni node_modules ni secrets locaux),
 * marqueurs remplacés, style et bibliothèque de composants appliqués (variantes), skills `po-`
 * ajoutées, un seul commit au nom du PO. Sans différence (création interrompue puis rejouée), rien
 * n'est poussé.
 */
export async function pousserModele(
  outils: { executer: Executer; env: NodeJS.ProcessEnv; url: string },
  login: string,
  dossierModele: string,
  aPersonnaliser: string[],
  exclus: string[],
  valeurs: ValeursProjet,
  dossierSkills: string | null = null,
  interfaceChoisie: { dossier: string; style: Style; composants: Composants } | null = null,
): Promise<void> {
  const travail = await mkdtemp(join(tmpdir(), 'ada-studio-creation-'));
  const copie = join(travail, 'depot');
  const { executer, env } = outils;
  const git = (...args: string[]) => executer('git', ['-C', copie, ...args], { env });
  try {
    await executer('git', ['clone', '--quiet', outils.url, copie], { env });
    await git('symbolic-ref', 'HEAD', 'refs/heads/main');
    await git('rm', '-r', '-q', '--ignore-unmatch', '--', '.');
    const { stdout } = await executer(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.'],
      { cwd: dossierModele },
    );
    const fichiers = stdout
      .split('\0')
      .filter(Boolean)
      .filter((fichier) => !exclus.some((dossier) => fichier === dossier || fichier.startsWith(`${dossier.replace(/\/$/, '')}/`)));
    if (!fichiers.includes('ada.json')) throw new Error(`Modèle incomplet : ${dossierModele}`);
    for (const fichier of fichiers) {
      const cible = join(copie, fichier);
      await mkdir(dirname(cible), { recursive: true });
      await copyFile(join(dossierModele, fichier), cible);
      if (aPersonnaliser.includes(fichier)) {
        await writeFile(cible, personnaliser(await readFile(cible, 'utf8'), valeurs));
      }
    }
    if (interfaceChoisie) {
      const { dossier, style, composants } = interfaceChoisie;
      await appliquerVariantes({ projet: copie, front: dossier, style, composants });
      // Dépendances ajoutées par les variantes : le fichier de verrouillage suit (installation en CI : npm ci).
      if ((style !== 'css-maison' || composants !== 'aucune') && existsSync(join(copie, dossier, 'package-lock.json'))) {
        await executer('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: join(copie, dossier) });
      }
    }
    await ajouterSkillsPo(copie, dossierSkills);
    await git('add', '-A');
    const { stdout: changements } = await git('status', '--porcelain');
    if (!changements.trim()) return;
    await git(
      '-c', `user.name=${login}`,
      '-c', `user.email=${login}@users.noreply.github.com`,
      'commit', '--quiet', '-m', `chore: création du projet ${valeurs.nom}`,
    );
    await git('push', '--quiet', 'origin', 'main');
  } finally {
    await rm(travail, { recursive: true, force: true });
  }
}
