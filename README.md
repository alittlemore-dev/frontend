# alittlemore.dev Frontend

<p align="center">
  <img src="./public/logo-512x512.png" alt="alittlemore.dev logo" width="180">
</p>

[🇷🇺 Russian version](./README_RU.md)

Shared frontend for [alittlemore.dev](https://alittlemore.dev): public site pages and protected workspaces. Built with Angular hybrid SSR/CSR.

| Category             | Technologies                                                                                                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Coverage             | ![coverage-frontend](./.github/badges/coverage-frontend.svg)                                                                                                                                                                                                                                                 |
| Frontend             | ![angular](./.github/badges/angular.svg) ![typescript](./.github/badges/typescript.svg) ![rxjs](./.github/badges/rxjs.svg) ![zonejs](./.github/badges/zonejs.svg) ![bootstrap](./.github/badges/bootstrap.svg) ![sass](./.github/badges/sass.svg)                                                            |
| SSR runtime          | ![node](./.github/badges/node.svg) ![express](./.github/badges/express.svg) ![angular-ssr](./.github/badges/angular-ssr.svg)                                                                                                                                                                                 |
| Editor and content   | ![codemirror](./.github/badges/codemirror.svg) ![lezer](./.github/badges/lezer.svg) ![marked](./.github/badges/marked.svg) ![dompurify](./.github/badges/dompurify.svg) ![prismjs](./.github/badges/prismjs.svg)                                                                                             |
| Testing              | ![jest](./.github/badges/jest.svg) ![jest-preset-angular](./.github/badges/jest-preset-angular.svg) ![jsdom](./.github/badges/jsdom.svg) ![lhci](./.github/badges/lhci.svg)                                                                                                                                  |
| Quality and security | ![eslint](./.github/badges/eslint.svg) ![angular-eslint](./.github/badges/angular-eslint.svg) ![prettier](./.github/badges/prettier.svg) ![npm-audit](./.github/badges/npm-audit.svg) ![hadolint](./.github/badges/hadolint.svg) ![dockle](./.github/badges/dockle.svg) ![trivy](./.github/badges/trivy.svg) |
| Build and delivery   | ![angular-cli](./.github/badges/angular-cli.svg) ![npm](./.github/badges/npm.svg) ![docker](./.github/badges/docker.svg) ![github-actions](./.github/badges/github-actions.svg) ![dependabot](./.github/badges/dependabot.svg)                                                                               |

## Local development

Use the Node.js version from [`.nvmrc`](./.nvmrc).

```bash
nvm use
make install
npm start
```

Application: `http://localhost:4200`, API: `http://localhost:8000`.
Run the full stack with `make dev` in the [infrastructure repository](https://github.com/alittlemore-dev/infrastructure).

## Checks

```bash
make format-check lint typecheck tests-coverage
```

See the [Makefile](./Makefile) for other build and check commands.
