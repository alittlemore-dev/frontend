import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'ru/articles/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'en/articles/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'ru/competency-matrix/questions/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'en/competency-matrix/questions/:slug',
    renderMode: RenderMode.Server,
  },
  {
    path: 'ru/how-this-site-is-built',
    renderMode: RenderMode.Server,
  },
  {
    path: 'en/how-this-site-is-built',
    renderMode: RenderMode.Server,
  },
  {
    path: 'ru/updates',
    renderMode: RenderMode.Server,
  },
  {
    path: 'en/updates',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
