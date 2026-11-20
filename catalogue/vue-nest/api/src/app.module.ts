import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { VersionController } from './version/version.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [AppController, VersionController],
  providers: [AppService],
})
export class AppModule {}
