import type { TypeProjet } from '../ada/ada-config.js';

/** Familles de projets, dans l'ordre d'affichage de « Que voulez-vous créer ? ». */
export const FAMILLES = [
  { id: 'service', libelle: 'Un service en ligne' },
  { id: 'outil-existant', libelle: 'Dans un outil déjà utilisé' },
  { id: 'sans-ecran', libelle: 'Sans écran : données et automatisation' },
  { id: 'idee', libelle: 'Pour montrer une idée' },
] as const;

export type Famille = (typeof FAMILLES)[number]['id'];

/** Tous les types de projet imaginables ; seuls ceux qui ont un modèle livré sont sélectionnables. */
export const TYPES: { id: TypeProjet; famille: Famille; libelle: string; description: string }[] = [
  { id: 'service', famille: 'service', libelle: 'Application en ligne', description: 'Des données, plusieurs écrans, des règles métier : réservation, suivi, inventaire…' },
  { id: 'formulaire', famille: 'service', libelle: 'Formulaire ou démarche', description: 'Recueillir des informations (inscription, demande, enquête) et consulter les réponses' },
  { id: 'tableau-de-bord', famille: 'service', libelle: 'Tableau de bord', description: 'Indicateurs, graphiques et tableaux pour suivre une activité' },
  { id: 'gestion', famille: 'service', libelle: 'Outil de gestion (back-office)', description: 'Administrer des données : listes, fiches, recherche, validation' },
  { id: 'site', famille: 'service', libelle: 'Site d’information', description: 'Pages publiques, actualités, bien référencées par les moteurs de recherche' },
  { id: 'documentation', famille: 'service', libelle: 'Guide ou documentation', description: 'Pages de documentation avec sommaire et recherche' },
  { id: 'carte', famille: 'service', libelle: 'Carte interactive', description: 'Des lieux, équipements ou zones sur une carte, avec filtres' },
  { id: 'mobile', famille: 'service', libelle: 'Application mobile', description: 'Installable sur téléphone depuis le navigateur, utilisable hors connexion' },
  { id: 'formation', famille: 'service', libelle: 'Formation ou quiz', description: 'Apprendre, s’entraîner, s’auto-évaluer' },
  { id: 'extension', famille: 'outil-existant', libelle: 'Extension de navigateur', description: 'Un outil dans Chrome, Firefox ou Edge' },
  { id: 'composant', famille: 'outil-existant', libelle: 'Composant à intégrer', description: 'Un bloc à insérer dans un autre site : simulateur, calculette, recherche' },
  { id: 'api', famille: 'sans-ecran', libelle: 'API', description: 'Mettre des données ou un calcul à disposition d’autres services' },
  { id: 'traitement', famille: 'sans-ecran', libelle: 'Traitement de données', description: 'Importer, nettoyer, convertir des fichiers ; tâche planifiée' },
  { id: 'maquette', famille: 'idee', libelle: 'Maquette cliquable', description: 'Montrer un parcours avant de le développer : données fictives, aucun serveur' },
];

export interface Modele {
  id: string;
  type: TypeProjet;
  libelle: string;
  pourQuoi: string;
  /** Vrai dès que le dossier `catalogue/<id>/` d'ADA contient le modèle (avec son ada.json). */
  disponible: boolean;
  /** Le modèle sait être déployé (Dockerfile et chart Helm) : la création propose de l'ajouter. */
  deployable: boolean;
  /**
   * Partie front : null sans front ; sinon, « variantes » dit si le style et la bibliothèque se
   * choisissent (sinon : CSS maison, sans bibliothèque).
   */
  interface: { variantes: boolean } | null;
}

/**
 * Toutes les stacks prévues, par type. Elles vivent dans le dépôt d'ADA (`catalogue/<id>/`), pas
 * dans des dépôts modèles GitHub : une stack est disponible dès que son dossier est livré.
 * Vue 3 + NestJS d'abord ; Python quand le besoin l'appelle (données, IA, back-office).
 * Aucun modèle ne porte d'identité de l'État : le style et la bibliothèque se choisissent à la création.
 */
export function catalogue(): Omit<Modele, 'disponible' | 'deployable' | 'interface'>[] {
  return [
    { id: 'vue-nest', type: 'service', libelle: 'Vue 3 + NestJS + PostgreSQL', pourQuoi: 'Application métier structurée, nombreuses règles, durée de vie longue' },
    { id: 'vue-node', type: 'service', libelle: 'Vue 3 + Node.js (Express)', pourQuoi: 'Petite application, peu de règles' },
    { id: 'vue-fastapi', type: 'service', libelle: 'Vue 3 + Python (FastAPI) + PostgreSQL', pourQuoi: 'Données, calculs, IA, import/export de fichiers' },
    { id: 'formulaire', type: 'formulaire', libelle: 'Formulaire (Vue 3 + Node.js)', pourQuoi: 'Réponses enregistrées dans le projet, page « Réponses » et export CSV' },
    { id: 'tableau-de-bord', type: 'tableau-de-bord', libelle: 'Vue 3 + NestJS, graphiques accessibles', pourQuoi: 'Indicateurs calculés côté serveur, graphiques accessibles' },
    { id: 'django', type: 'gestion', libelle: 'Python (Django), administration intégrée', pourQuoi: 'Listes, fiches et droits prêts à l’emploi' },
    { id: 'nuxt', type: 'site', libelle: 'Nuxt, pages générées', pourQuoi: 'Pages générées pour un bon référencement (SEO), déclaration d’accessibilité incluse' },
    { id: 'vitepress', type: 'documentation', libelle: 'VitePress', pourQuoi: 'Pages écrites en Markdown, recherche intégrée, accessibilité de chaque page vérifiée' },
    { id: 'carte', type: 'carte', libelle: 'Vue 3 + MapLibre', pourQuoi: 'Fonds de carte IGN, données GeoJSON' },
    { id: 'pwa', type: 'mobile', libelle: 'Vue 3 installable (PWA)', pourQuoi: 'Une seule application pour téléphone et ordinateur' },
    { id: 'quiz', type: 'formation', libelle: 'Vue 3, sans serveur', pourQuoi: 'Questions et parcours décrits dans des fichiers' },
    { id: 'extension', type: 'extension', libelle: 'Extension de navigateur (Vue)', pourQuoi: 'Chrome, Firefox, Edge' },
    { id: 'composant', type: 'composant', libelle: 'Composant web (Vue)', pourQuoi: 'Une balise à coller dans n’importe quelle page' },
    { id: 'api-nest', type: 'api', libelle: 'NestJS + PostgreSQL, documentation OpenAPI', pourQuoi: 'API documentée et testée' },
    { id: 'api-fastapi', type: 'api', libelle: 'Python (FastAPI) + PostgreSQL', pourQuoi: 'Calculs, données, IA' },
    { id: 'traitement-python', type: 'traitement', libelle: 'Python (scripts planifiés)', pourQuoi: 'Fichiers CSV nettoyés et contrôlés, rapport lisible ; exécution planifiée par la CI' },
    { id: 'maquette', type: 'maquette', libelle: 'Maquette Vue 3', pourQuoi: 'Parcours cliquable, données fictives, aucun serveur' },
  ];
}

/** Labels posés à la création d'un projet : types de demande et statuts gérés par l'atelier. */
export const LABELS_ATELIER = [
  { name: 'user-story', color: '0f766e', description: 'Story écrite par le PO' },
  { name: 'mode-libre', color: '6a6af4', description: 'Demande libre du PO (mode sauvage, hors story)' },
  { name: 'mode-conversation', color: '6a6af4', description: 'Conversation libre du PO avec ADA' },
  { name: 'bug', color: 'b42318', description: 'Problème signalé par le PO' },
  { name: 'story:en-cours', color: '0063cb', description: 'Lancée depuis ADA' },
  { name: 'story:questions', color: 'b34000', description: 'ADA attend des réponses du PO' },
  { name: 'story:plan-a-valider', color: 'b34000', description: 'Le PO doit valider le plan' },
  { name: 'story:en-verification', color: '0063cb', description: 'Réalisée, contrôles en cours' },
  { name: 'story:besoin-dev', color: 'b42318', description: 'Bloquée : un développeur doit intervenir' },
  { name: 'story:decoupage-a-valider', color: 'b34000', description: 'Le PO choisit les stories du découpage proposé' },
  { name: 'story:parent', color: '6a6af4', description: 'Demande découpée en stories' },
  { name: 'story:conversation', color: 'b34000', description: 'ADA a répondu : au PO d’écrire' },
  { name: 'story:en-attente', color: '929292', description: 'Rien à construire pour l’instant : à relancer plus tard' },
];
