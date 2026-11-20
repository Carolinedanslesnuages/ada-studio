<script setup lang="ts">
import { computed, nextTick, reactive, ref, useTemplateRef, watch } from 'vue'
import {
  type ConseilStack,
  type FamilleDeProjet,
  type TypeDeProjet,
  type TypeProjet,
  normaliserNom,
  slugifier,
  verifierProjet,
  type ErreursProjet,
  type Combinaisons,
  type Modele,
  type NouveauProjet,
} from '@/lib/projet'
import ChoixInterface from '@/components/ChoixInterface.vue'

const props = defineProps<{
  familles: FamilleDeProjet[]
  types: TypeDeProjet[]
  modeles: Modele[]
  /** Styles et bibliothèques de composants proposés (null : catalogue sans interface). */
  combinaisons?: Combinaisons | null
  erreursServeur?: ErreursProjet | null
  /** L'assistant propose une stack d'après l'idée (#68) ; absent : pas de bouton de conseil. */
  conseiller?: (idee: string) => Promise<ConseilStack>
  envoiEnCours?: boolean
}>()
const emit = defineEmits<{ soumettre: [projet: NouveauProjet]; annuler: [] }>()

const projet = reactive<NouveauProjet>({ nom: '', idee: '', objectif: '', modele: '', baseline: '', deploye: false, visibilite: 'prive', style: 'css-maison', composants: 'aucune' })
const erreursLocales = ref<ErreursProjet>({})
const erreurs = computed<ErreursProjet>(() => ({ ...erreursLocales.value, ...props.erreursServeur }))
const adresse = computed(() => slugifier(normaliserNom(projet.nom)))

/** D'abord le type de projet, puis la stack de ce type (choisie d'office s'il n'y en a qu'une). */
const typeChoisi = ref<TypeProjet | null>(null)
/** Seuls les modèles livrés sont proposés : rien « en attente de développement » à l'écran. */
const modelesDisponibles = computed(() => props.modeles.filter((modele) => modele.disponible))
const modelesDuType = computed(() => modelesDisponibles.value.filter((modele) => modele.type === typeChoisi.value))
/** Types qui ont au moins un modèle livré, regroupés par famille (familles vides omises). */
const famillesAvecTypes = computed(() =>
  props.familles
    .map((famille) => ({
      ...famille,
      types: props.types.filter(
        (type) => type.famille === famille.id && modelesDisponibles.value.some((modele) => modele.type === type.id),
      ),
    }))
    .filter((famille) => famille.types.length > 0),
)
watch(typeChoisi, () => {
  projet.modele = modelesDuType.value.length === 1 ? modelesDuType.value[0]!.id : ''
})

const modeleChoisi = computed(() => props.modeles.find((modele) => modele.id === projet.modele) ?? null)
watch(modeleChoisi, (modele) => {
  if (!modele?.deployable) projet.deploye = false
})

/** Conseil de l'assistant : il lit l'idée, puis ADA présélectionne le type et la stack proposés. */
const conseil = ref<ConseilStack | null>(null)
const conseilEnCours = ref(false)
const erreurConseil = ref<string | null>(null)
const ideeSuffisante = computed(() => (projet.idee ?? '').trim().length >= 10)
const modeleConseille = computed(() => props.modeles.find((modele) => modele.id === conseil.value?.modele) ?? null)
async function demanderConseil(): Promise<void> {
  if (!props.conseiller || !ideeSuffisante.value) return
  conseilEnCours.value = true
  erreurConseil.value = null
  conseil.value = null
  try {
    const reponse = await props.conseiller(projet.idee ?? '')
    const modele = props.modeles.find((candidat) => candidat.id === reponse.modele && candidat.disponible)
    if (!modele) throw new Error('ADA n’a pas pu proposer de stack : choisissez-la vous-même dans la liste.')
    conseil.value = reponse
    typeChoisi.value = modele.type
    await nextTick()
    projet.modele = modele.id
  } catch (e) {
    erreurConseil.value = (e as Error).message
  } finally {
    conseilEnCours.value = false
  }
}

/**
 * Étapier (#68) : d'abord l'idée (l'assistant peut orienter la stack), puis le type et la stack,
 * enfin le nom et la présentation. Chaque étape est vérifiée avant de passer à la suivante.
 */
const ETAPES = ['Votre idée', 'Type de projet et stack', 'Nom et présentation'] as const
/** Visibilité du dépôt : privé par défaut ; public = code visible de tous sur GitHub. */
const optionsVisibilite = [
  { label: 'Privé', value: 'prive', hint: 'Seuls vous et les personnes que vous invitez voient le dépôt sur GitHub. Le choix par défaut.' },
  { label: 'Public', value: 'public', hint: 'Tout le monde peut voir le code sur GitHub. Jamais de donnée réelle ni de secret dans le projet.' },
]
const CHAMPS_PAR_ETAPE: (keyof NouveauProjet)[][] = [['idee'], ['modele', 'style', 'composants'], ['nom', 'objectif', 'baseline']]
const etape = ref(1)
const zoneEtapes = useTemplateRef<HTMLElement>('zone-etapes')

/** Le focus va au titre de l'étape : lecteurs d'écran et clavier savent où ils en sont. */
async function allerA(numero: number): Promise<void> {
  etape.value = numero
  await nextTick()
  const titre = zoneEtapes.value?.querySelector<HTMLElement>('h2, h3')
  titre?.setAttribute('tabindex', '-1')
  titre?.focus()
}

/** Erreurs de l'étape en cours seulement (les autres champs ne sont pas encore remplis). */
function etapeValide(numero: number): boolean {
  const toutes = verifierProjet(projet)
  const champs = CHAMPS_PAR_ETAPE[numero - 1]!
  erreursLocales.value = Object.fromEntries(Object.entries(toutes).filter(([champ]) => champs.includes(champ as keyof NouveauProjet)))
  return Object.keys(erreursLocales.value).length === 0
}

/** Le serveur refuse un champ : retour à l'étape qui le contient. */
watch(
  () => props.erreursServeur,
  (erreursServeur) => {
    if (!erreursServeur) return
    const numero = CHAMPS_PAR_ETAPE.findIndex((champs) => champs.some((champ) => erreursServeur[champ]))
    if (numero >= 0) void allerA(numero + 1)
  },
)

function precedent(): void {
  erreursLocales.value = {}
  void allerA(etape.value - 1)
}

function envoyer(): void {
  if (!etapeValide(etape.value)) return
  if (etape.value < ETAPES.length) {
    void allerA(etape.value + 1)
    return
  }
  erreursLocales.value = verifierProjet(projet)
  if (Object.keys(erreursLocales.value).length > 0) return
  emit('soumettre', {
    ...projet,
    nom: normaliserNom(projet.nom),
    baseline: normaliserNom(projet.baseline),
  })
}
</script>

<template>
  <form novalidate @submit.prevent="envoyer">
    <h2 class="titre-4">Nouveau projet</h2>
    <p class="texte-sm">
      Racontez votre idée : ADA crée le projet sur votre compte GitHub, et ADA s’en
      saisit aussitôt. L’objectif et la baseline sont facultatifs.
    </p>

    <div ref="zone-etapes">
      <UiEtapes :steps="[...ETAPES]" :current-step="etape" />
    </div>

    <template v-if="etape === 1">
      <UiChamp
        v-model="projet.idee"
        label="Votre idée"
        hint="Racontez-la comme elle vient, même en vrac : le besoin, pour qui, ce qui vous gêne aujourd’hui… ADA vous posera ses questions, puis vous proposera les premières stories à valider."
        label-visible
        is-textarea
        rows="6"
        :error-message="erreurs.idee"
      />
      <div v-if="conseiller" class="mb-3w">
        <UiBouton
          type="button"
          secondary
          size="sm"
          :label="conseilEnCours ? 'ADA réfléchit…' : 'Demander conseil à ADA pour la stack'"
          :disabled="conseilEnCours || !ideeSuffisante"
          aria-describedby="conseil-aide"
          @click="demanderConseil"
        />
        <p id="conseil-aide" class="champ__aide mt-1v">
          ADA lit votre idée et présélectionne, à l’étape suivante, le type de projet et la
          stack les plus adaptés. Vous pourrez toujours choisir autre chose.
        </p>
        <div role="status">
          <UiAlerte
            v-if="conseil && modeleConseille"
            type="info"
            small
            :description="`Conseil d’ADA : ${modeleConseille.libelle}. ${conseil.raison}`"
          />
        </div>
        <p v-if="erreurConseil" class="champ__erreur" role="alert">{{ erreurConseil }}</p>
      </div>
    </template>

    <template v-else-if="etape === 2">
      <UiAlerte
        v-if="conseil && modeleConseille"
        type="info"
        small
        class="mb-3w"
        :description="`ADA conseille : ${modeleConseille.libelle}. Ce choix est présélectionné ; vous pouvez choisir autre chose.`"
      />
      <fieldset class="groupe-choix" :class="{ 'groupe-choix--erreur': erreurs.modele && !typeChoisi }">
        <legend class="groupe-choix__legende">Que voulez-vous créer ?</legend>
        <div v-for="famille in famillesAvecTypes" :key="famille.id" class="groupe-choix__element">
          <fieldset class="groupe-choix">
            <legend class="groupe-choix__legende groupe-choix__legende--normale texte-gras">
              {{ famille.libelle }}
            </legend>
            <div v-for="type in famille.types" :key="type.id" class="groupe-choix__element">
              <div class="choix">
                <input
                  :id="`type-${type.id}`"
                  v-model="typeChoisi"
                  type="radio"
                  name="type-projet"
                  :value="type.id"
                />
                <label class="champ__etiquette" :for="`type-${type.id}`">
                  {{ type.libelle }}
                  <span class="champ__aide">{{ type.description }}</span>
                </label>
              </div>
            </div>
          </fieldset>
        </div>
      </fieldset>

      <fieldset
        v-if="typeChoisi"
        class="groupe-choix"
        :class="{ 'groupe-choix--erreur': erreurs.modele }"
        aria-describedby="stack-aide"
      >
        <legend class="groupe-choix__legende">Stack technique</legend>
        <p id="stack-aide" class="champ__aide groupe-choix__element">
          Les stacks proposées par ADA studio pour ce type de projet.
        </p>
        <div v-for="modele in modelesDuType" :key="modele.id" class="groupe-choix__element">
          <div class="choix">
            <input
              :id="`modele-${modele.id}`"
              v-model="projet.modele"
              type="radio"
              name="modele"
              :value="modele.id"
            />
            <label class="champ__etiquette" :for="`modele-${modele.id}`">
              {{ modele.libelle }}<template v-if="modele.id === conseil?.modele"> (conseillée par ADA)</template>
              <span class="champ__aide">{{ modele.pourQuoi }}</span>
            </label>
          </div>
        </div>
        <p v-if="erreurs.modele" class="champ__erreur groupe-choix__element" role="alert">
          {{ erreurs.modele }}
        </p>
      </fieldset>
      <p v-else-if="erreurs.modele" class="champ__erreur" role="alert">Choisissez ce que vous voulez créer</p>

      <ChoixInterface
        v-if="modeleChoisi"
        v-model:style="projet.style!"
        v-model:composants="projet.composants!"
        :modele="modeleChoisi"
        :combinaisons="combinaisons ?? null"
        :erreur="erreurs.composants"
      />

      <div v-if="modeleChoisi?.deployable" class="groupe-choix__element mb-3w">
        <div class="choix">
          <input id="projet-deploye" v-model="projet.deploye" type="checkbox" aria-describedby="projet-deploye-aide" />
          <label class="champ__etiquette" for="projet-deploye">
            Ce projet sera déployé (mis en ligne)
            <span id="projet-deploye-aide" class="champ__aide">
              ADA ajoute de quoi l’héberger : un chart Helm, vérifié à chaque demande. L’équipe
              infra fournit ensuite l’adresse et le registre. Modifiable plus tard par un développeur.
            </span>
          </label>
        </div>
      </div>
    </template>

    <template v-else>
      <UiChamp
        v-model="projet.nom"
        label="Nom du projet"
        :hint="adresse ? `Adresse du dépôt : ${adresse}` : 'Exemple : Réservation de salles'"
        label-visible
        :error-message="erreurs.nom"
      />
      <UiChamp
        v-model="projet.objectif"
        label="Objectif en une phrase (facultatif)"
        hint="Si vous savez déjà le dire. Sinon, ADA reprend la première phrase de votre idée."
        label-visible
        is-textarea
        :error-message="erreurs.objectif"
      />
      <UiChamp
        v-model="projet.baseline"
        label="Baseline (facultatif)"
        hint="Phrase courte affichée sous le nom du service dans l’en-tête. Exemple : Ma journée avec POC Portail"
        label-visible
        :error-message="erreurs.baseline"
      />
      <UiChoixUnique
        v-model="projet.visibilite"
        name="visibilite"
        legend="Visibilité du dépôt GitHub"
        :options="optionsVisibilite"
        :error-message="erreurs.visibilite"
      />
    </template>

    <ul class="groupe-boutons">
      <li v-if="etape > 1">
        <UiBouton type="button" secondary label="Étape précédente" @click="precedent" />
      </li>
      <li>
        <UiBouton
          type="submit"
          :label="etape < ETAPES.length ? 'Étape suivante' : envoiEnCours ? 'Création en cours…' : 'Créer le projet'"
          :disabled="envoiEnCours"
        />
      </li>
      <li>
        <UiBouton type="button" tertiary label="Annuler" @click="emit('annuler')" />
      </li>
    </ul>
  </form>
</template>
