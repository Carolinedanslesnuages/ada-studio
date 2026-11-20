import { Test } from '@nestjs/testing';
import { SanteController } from './sante.controller.js';

describe('SanteController', () => {
  it('dit que l’API est prête', async () => {
    const module = await Test.createTestingModule({ controllers: [SanteController] }).compile();
    expect(module.get(SanteController).etat()).toEqual({ statut: 'ok' });
  });
});
