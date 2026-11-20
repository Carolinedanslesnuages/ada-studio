import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Réglages communs à main.ts et aux tests e2e. */
export function configurerApp(app: INestApplication): void {
  // Les routes déclarent elles-mêmes leur chemin complet (/api/...) : pas de préfixe global, pour
  // que la racine mène à la documentation.
  // Chaque entrée est validée par son DTO (class-validator) ; un champ inconnu est refusé.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('__NOM_PROJET__')
      .setDescription('Documentation de l’API (OpenAPI), générée à partir du code. Données fictives uniquement.')
      .setVersion('0.1.0')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    customSiteTitle: '__NOM_PROJET__ — documentation de l’API',
  });
}
