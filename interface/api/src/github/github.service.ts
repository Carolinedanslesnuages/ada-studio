import { Injectable } from '@nestjs/common';
import { retry } from '@octokit/plugin-retry';
import { Octokit } from '@octokit/rest';

/**
 * Client GitHub avec nouvelles tentatives automatiques sur les erreurs passagères (coupure
 * réseau, erreurs 5xx) : une connexion lente ne doit pas faire échouer une création de projet.
 * Les erreurs de fond (400, 401, 403, 404, 422) ne sont jamais réessayées.
 */
const OctokitAvecReprise = Octokit.plugin(retry);

/** Fabrique un client GitHub qui agit au nom du PO connecté. */
@Injectable()
export class GithubService {
  client(jeton: string): Octokit {
    return new OctokitAvecReprise({ auth: jeton, userAgent: 'ada-studio', retry: { retries: 3 } }) as unknown as Octokit;
  }
}
