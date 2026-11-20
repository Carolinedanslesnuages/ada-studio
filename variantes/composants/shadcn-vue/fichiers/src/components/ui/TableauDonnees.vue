<script setup lang="ts">
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** Tableau de données (shadcn-vue) : titre, en-têtes de colonnes, état de chargement et message si vide. */
withDefaults(
  defineProps<{
    titre: string
    colonnes: { cle: string; libelle: string }[]
    lignes: Record<string, string | number>[]
    chargement?: boolean
    messageVide?: string
  }>(),
  { messageVide: 'Aucune donnée pour le moment.' },
)
</script>

<template>
  <Table :aria-busy="chargement ? 'true' : undefined">
    <TableCaption class="caption-top text-left font-bold text-foreground">{{ titre }}</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead v-for="colonne in colonnes" :key="colonne.cle" scope="col">{{ colonne.libelle }}</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-if="chargement">
        <TableCell :colspan="colonnes.length">Chargement…</TableCell>
      </TableRow>
      <TableRow v-else-if="!lignes.length">
        <TableCell :colspan="colonnes.length">{{ messageVide }}</TableCell>
      </TableRow>
      <template v-else>
        <TableRow v-for="(ligne, rang) in lignes" :key="rang">
          <TableCell v-for="colonne in colonnes" :key="colonne.cle">{{ ligne[colonne.cle] }}</TableCell>
        </TableRow>
      </template>
    </TableBody>
  </Table>
</template>
