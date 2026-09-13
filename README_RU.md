# Frontend alittlemore.dev

<p align="center">
  <img src="./public/logo-512x512.png" alt="Логотип alittlemore.dev" width="180">
</p>

[🇺🇸 English version](./README.md)

Общий frontend [alittlemore.dev](https://alittlemore.dev): публичные страницы сайта и защищённые рабочие области. Angular с гибридным SSR/CSR.

| Категория               | Технологии                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Покрытие                | ![coverage-frontend](./.github/badges/coverage-frontend.svg)                                                                                                                                                                                                                                                 |
| Frontend                | ![angular](./.github/badges/angular.svg) ![typescript](./.github/badges/typescript.svg) ![rxjs](./.github/badges/rxjs.svg) ![zonejs](./.github/badges/zonejs.svg) ![bootstrap](./.github/badges/bootstrap.svg) ![sass](./.github/badges/sass.svg)                                                            |
| SSR runtime             | ![node](./.github/badges/node.svg) ![express](./.github/badges/express.svg) ![angular-ssr](./.github/badges/angular-ssr.svg)                                                                                                                                                                                 |
| Редактор и контент      | ![codemirror](./.github/badges/codemirror.svg) ![lezer](./.github/badges/lezer.svg) ![marked](./.github/badges/marked.svg) ![dompurify](./.github/badges/dompurify.svg) ![prismjs](./.github/badges/prismjs.svg)                                                                                             |
| Тестирование            | ![jest](./.github/badges/jest.svg) ![jest-preset-angular](./.github/badges/jest-preset-angular.svg) ![jsdom](./.github/badges/jsdom.svg) ![lhci](./.github/badges/lhci.svg)                                                                                                                                  |
| Качество и безопасность | ![eslint](./.github/badges/eslint.svg) ![angular-eslint](./.github/badges/angular-eslint.svg) ![prettier](./.github/badges/prettier.svg) ![npm-audit](./.github/badges/npm-audit.svg) ![hadolint](./.github/badges/hadolint.svg) ![dockle](./.github/badges/dockle.svg) ![trivy](./.github/badges/trivy.svg) |
| Сборка и доставка       | ![angular-cli](./.github/badges/angular-cli.svg) ![npm](./.github/badges/npm.svg) ![docker](./.github/badges/docker.svg) ![github-actions](./.github/badges/github-actions.svg) ![dependabot](./.github/badges/dependabot.svg)                                                                               |

## Локальный запуск

Node.js — версия из [`.nvmrc`](./.nvmrc).

```bash
nvm use
make install
npm start
```

Приложение: `http://localhost:4200`, API: `http://localhost:8000`.
Полный стек запускается через `make dev` в [репозитории инфраструктуры](https://github.com/alittlemore-dev/infrastructure).

## Проверки

```bash
make format-check lint typecheck tests-coverage
```

Остальные команды сборки и проверок — в [Makefile](./Makefile).
