import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { SanteController } from './sante/sante.controller.js';
import { VersionController } from './version/version.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [SanteController, VersionController],
})
export class AppModule {}
