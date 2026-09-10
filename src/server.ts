import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { join } from 'node:path';
import { createExpressApp, readRequiredPort } from './server-app';

const browserDistFolder = join(import.meta.dirname, '../browser');
const app = createExpressApp({
  browserDistFolder,
  angularApp: new AngularNodeAppEngine(),
  responseWriter: writeResponseToNodeResponse,
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = readRequiredPort();
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
