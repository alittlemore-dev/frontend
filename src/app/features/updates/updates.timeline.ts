import { LanguageCode } from '../../core/i18n/i18n.model';

interface LocalizedText {
  readonly ru: string;
  readonly en: string;
}

export type UpdateTagId =
  | 'admin'
  | 'analytics'
  | 'auth'
  | 'backend'
  | 'content'
  | 'delivery'
  | 'frontend'
  | 'infra'
  | 'localization'
  | 'matrix'
  | 'quality'
  | 'security'
  | 'seo';

export interface UpdateTimelineEntry {
  readonly id: string;
  readonly month: string;
  readonly order: number;
  readonly title: LocalizedText;
  readonly summary: LocalizedText;
  readonly tagIds: readonly UpdateTagId[];
}

export interface LocalizedUpdateEntry {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly tagKeys: readonly string[];
}

export interface UpdateGroup {
  readonly datetime: string;
  readonly label: string;
  readonly entries: readonly LocalizedUpdateEntry[];
}

const UPDATE_TAG_I18N_KEYS: Readonly<Record<UpdateTagId, string>> = {
  admin: 'updates.tag.admin',
  analytics: 'updates.tag.analytics',
  auth: 'updates.tag.auth',
  backend: 'updates.tag.backend',
  content: 'updates.tag.content',
  delivery: 'updates.tag.delivery',
  frontend: 'updates.tag.frontend',
  infra: 'updates.tag.infra',
  localization: 'updates.tag.localization',
  matrix: 'updates.tag.matrix',
  quality: 'updates.tag.quality',
  security: 'updates.tag.security',
  seo: 'updates.tag.seo',
};

export const UPDATES_TIMELINE_ENTRIES: readonly UpdateTimelineEntry[] = [
  {
    id: 'full-security-audit',
    month: '2026-07',
    order: 1,
    title: {
      ru: 'Проведён полный аудит безопасности',
      en: 'Full security audit completed',
    },
    summary: {
      ru:
        'Июльский аудит безопасности прошёл по всему контуру: оформлена модель угроз, ' +
        'усилены Docker/nginx/MinIO, CI image checks и production checklist, а также ' +
        'PASETO/OpenAPI и XSS-чувствительные frontend-пути.',
      en:
        'The July security audit covered the whole surface: threat modeling, ' +
        'Docker/nginx/MinIO hardening, CI image checks, the production checklist, ' +
        'plus PASETO/OpenAPI and XSS-sensitive frontend paths.',
    },
    tagIds: ['security', 'infra', 'backend', 'frontend', 'quality'],
  },
  {
    id: 'public-updates-page',
    month: '2026-07',
    order: 5,
    title: {
      ru: 'Появился публичный журнал изменений',
      en: 'Public updates page went live',
    },
    summary: {
      ru:
        'Сайт получил страницу обновлений с полной историей сайта, сжатой до крупных ' +
        'вех: публичный контент, админка, качество, безопасность и инфраструктура.',
      en:
        'The site gained an updates page with compressed site history focused on major ' +
        'milestones: public content, admin workflows, quality, security, and infrastructure.',
    },
    tagIds: ['content', 'frontend', 'backend', 'seo'],
  },
  {
    id: 'auth-session-hardening',
    month: '2026-07',
    order: 3,
    title: {
      ru: 'Авторизация стала устойчивее к долгим сессиям',
      en: 'Authorization became steadier for long sessions',
    },
    summary: {
      ru:
        'Админская авторизация получила скользящие серверные сессии: активный ' +
        'refresh продлевает idle lifetime только до absolute lifetime cap, а истёкшие ' +
        'сессии ежедневно удаляются фоновой задачей. В деталке участника теперь видно ' +
        'активные сессии с безопасными device-метками и можно отзывать текущую, одну, ' +
        'все или другие сессии.',
      en:
        'Admin authorization gained sliding server-side sessions: active refresh extends ' +
        'the idle lifetime only up to the absolute lifetime cap, and expired sessions are ' +
        'physically pruned by a daily background task. Team member details now show active ' +
        'sessions with safe device labels and can revoke the current, one, all, or other ' +
        'sessions.',
    },
    tagIds: ['auth', 'security', 'backend', 'frontend', 'admin'],
  },
  {
    id: 'matrix-question-queue-workflow',
    month: '2026-07',
    order: 7,
    title: {
      ru: 'Обработка очереди вопросов матрицы ускорилась',
      en: 'Matrix question queue processing became faster',
    },
    summary: {
      ru:
        'Очередь получила общий RU/EN Markdown-form со sticky actions, сценарии ' +
        '«создать/отклонить и далее» и «пропустить», а импорт из txt/csv/xlsx теперь ' +
        'показывает предпросмотр, ошибки валидации и точные дубли до подтверждения. ' +
        'Общая форма также получила независимый от провайдера RU→EN workspace: связанные ' +
        'пары полей, проверку готовности и совпадений, EN-предпросмотр и версионный JSON ' +
        'для безопасного copy/import с сохранением Markdown, code, URL и typed wiki links. ' +
        'Для AI-агентов отдельная machine-граница теперь остаётся на edge: семь REST operations ' +
        'смонтированы в основном Litestar app и используют общие settings, DI и DB session вместо ' +
        'отдельного процесса и UDS. WireGuard-bound nginx mTLS-listener пропускает только точный ' +
        'allowlist, а public listener возвращает 404 для внутреннего пути и удаляет поддельный ' +
        'certificate header. MCP остался локальным stdio-мостом к пяти Draft-only операциям. ' +
        'Раздельные сертификаты, scopes и privacy-safe аудит сохраняются; упрощение осознанно ' +
        'оставляет общими с backend процесс, роль БД, секреты и контур доступности.',
      en:
        'The queue gained a shared RU/EN Markdown form with sticky actions, create/reject-and-next ' +
        'and skip flows, while txt/csv/xlsx imports now show a preview, validation errors, and ' +
        'exact duplicates before confirmation. ' +
        'The shared form also gained a provider-agnostic RU→EN workspace with connected field ' +
        'pairs, completeness and identical-text review, direct EN preview, and versioned JSON ' +
        'copy/import that preserves Markdown, code, URLs, and typed wiki links. ' +
        'The separate machine boundary for AI agents now ' +
        'stays at the edge: seven REST operations are mounted in the main Litestar app and reuse ' +
        'its settings, DI, and DB session instead of a separate process and UDS. The dedicated ' +
        'WireGuard-bound nginx mTLS listener forwards only an exact allowlist, while the public ' +
        'listener returns 404 for the internal path and strips forged certificate headers. MCP ' +
        'remains a local stdio bridge to five Draft-only operations. Distinct certificates, ' +
        'scopes, and privacy-safe audit remain; the simplification intentionally shares the ' +
        'backend process, DB role, secrets, and availability.',
    },
    tagIds: ['admin', 'frontend', 'backend', 'matrix', 'content', 'localization', 'security'],
  },
  {
    id: 'release-workflow',
    month: '2026-07',
    order: 10,
    title: {
      ru: 'Релизы и интерфейс стали аккуратнее',
      en: 'Release workflow and interface polish',
    },
    summary: {
      ru:
        'CI/CD quality, smoke и deploy jobs разделены понятнее, релиз снова требует ' +
        'ручного подтверждения, а файлы, статистика, мобильные сценарии, локализованные ' +
        'даты и защита несохранённых изменений во всех формах админки получили июльскую ' +
        'полировку.',
      en:
        'CI/CD quality, smoke, and deploy jobs are easier to follow, production deploys ' +
        'require manual approval again, while file handling, statistics, mobile admin flows, ' +
        'locale-aware dates, and unsaved-change protection across admin forms received July ' +
        'polish.',
    },
    tagIds: ['delivery', 'quality', 'admin', 'infra', 'frontend', 'localization'],
  },
  {
    id: 'admin-operational-tools',
    month: '2026-07',
    order: 12,
    title: {
      ru: 'В workspace появились служебные инструменты',
      en: 'Workspace gained operational tools',
    },
    summary: {
      ru:
        'Владельцы и администраторы теперь видят состояние кэша по доменам, могут ' +
        'отдельно очистить его или запустить наблюдаемый прогрев, а также проверить ' +
        'и удалить протухшие сессии.',
      en:
        'Owners and administrators can now inspect cache domains, clear them or start ' +
        'an observable warm independently, and inspect and prune expired sessions.',
    },
    tagIds: ['admin', 'backend', 'frontend', 'infra', 'auth'],
  },
  {
    id: 'custom-markdown-editor',
    month: '2026-07',
    order: 14,
    title: {
      ru: 'Markdown-редактор стал полностью своим',
      en: 'Markdown authoring gained a custom editor',
    },
    summary: {
      ru:
        'Статьи, вопросы матрицы и RU→EN workspace перешли с Toast UI на общий ' +
        'CodeMirror-редактор: отдельные режимы редактора с псевдорендерами, чистого исходника и ' +
        'безопасного превью, независимые от раскладки горячие клавиши, smart lists/fences, поиск ' +
        'и вставка нескольких изображений. Markdown-таблицы стали интерактивными, но сохранили ' +
        'обычный переносимый исходник: ячейки выделяются прямоугольным диапазоном, Delete и Cut ' +
        'адаптивно очищают ячейки или удаляют полностью выбранные строки, столбцы и таблицу, ' +
        'добавление доступно через плюсики на нижней и правой гранях, а строки и столбцы ' +
        'переставляются за крайние drag handles с заметными маркерами захвата и места вставки. ' +
        'Сетка выглядит частью редактора без отдельной ' +
        'карточки и фантомных столбцов: адаптивные колонки и плюсики остаются в ширине редактора, ' +
        'пустые ячейки открываются без скачка страницы, а строки до и после таблицы не перекрываются. ' +
        'Активная ячейка показывает каретку на позиции ввода даже без текста, удерживает повторный ' +
        'ввод в той же ячейке в Chrome и Firefox и не прокручивает страницу при печати. ' +
        'Markdown-разделитель не занимает визуальную строку, а защищённая ' +
        'пустая строка после таблицы не даёт следующему тексту стать её новой строкой в редакторе ' +
        'или превью; сам текст совпадает со своим номером в gutter. ' +
        'Пустые строки сохраняют высоту, а стрелки не перескакивают через обычный текст рядом с ' +
        'таблицей. Контекстное меню объединяет структурные ' +
        'операции, сортировку и выравнивание, а TSV/CSV можно копировать и вставлять. ' +
        'Wiki-ссылки получили синтаксическую подсветку и двухшаговое автодополнение домена и цели: ' +
        'черновики и опубликованные материалы видны в одном списке, а вставка с клавиатуры ' +
        'оставляет место для необязательной подписи. Редактор растёт вместе с текстом без ' +
        'внутренней вертикальной прокрутки, а sticky-панели режимов, компактных иконок всех ' +
        'команд и справки по горячим клавишам остаются доступны в длинных документах. Доступный ' +
        'полноэкранный режим сохраняет текущий текст, выделения и историю отмены, удерживает ' +
        'фокус внутри редактора и возвращает пользователя к прежнему месту формы после выхода.',
      en:
        'Articles, matrix questions, and the RU→EN workspace moved from Toast UI to a shared ' +
        'CodeMirror editor with separate pseudo-rendered Editor, plain Source, and sanitized ' +
        'Preview modes, layout-independent shortcuts, smart lists and fences, search, and ordered ' +
        'multi-image insertion. Markdown tables are now interactive while retaining portable plain ' +
        'source: cells form rectangular selections; Delete and Cut adaptively clear cells or remove ' +
        'fully selected rows, columns, and the whole table; edge-only plus controls add rows and ' +
        'columns; and edge drag handles reorder them with visible pickup and drop markers. The grid ' +
        'now reads as part of the editor ' +
        'without card chrome or phantom columns: responsive columns and plus controls stay within ' +
        'the editor width, empty cells open without jumping the page, and lines around a table are ' +
        'not covered. The active cell keeps a caret at the input position even when empty, keeps ' +
        'repeated Chrome and Firefox input in the addressed cell, and does not move the page while ' +
        'typing. The Markdown delimiter takes no visual row, while a protected blank ' +
        'line after the table keeps following prose out of the grid in both Editor and Preview and ' +
        'aligned with its gutter number. Empty rows keep ' +
        'their height, and arrow navigation does not skip ordinary ' +
        'text around a table. A context menu groups structural actions, ' +
        'sorting, and alignment, while TSV and CSV remain available through the clipboard. Wiki-links now have ' +
        'syntax-aware highlighting and two-stage domain/target completion: Draft and Published ' +
        'content is discoverable together, while keyboard-first insertion leaves room for an ' +
        'optional label. The editor now grows with its content instead of scrolling vertically ' +
        'inside itself, while sticky mode controls, a compact all-command icon toolbar, and the ' +
        'shortcut reference remain available throughout long documents. Accessible fullscreen ' +
        'preserves the current text, selections, and undo history, keeps focus inside the editor, ' +
        'and returns the author to the same place in the form on exit.',
    },
    tagIds: ['admin', 'frontend', 'content', 'matrix', 'localization', 'quality'],
  },
  {
    id: 'public-seo-layer',
    month: '2026-06',
    order: 10,
    title: {
      ru: 'Публичный SEO-контур вышел в SSR',
      en: 'Public SEO layer went live',
    },
    summary: {
      ru:
        'Статьи, вопросы матрицы и engineering case-study получили Angular SSR, ' +
        'metadata, Open Graph, JSON-LD, sitemap и robots.txt для стабильной ' +
        'публичной выдачи.',
      en:
        'Articles, matrix question pages, and the engineering case-study gained ' +
        'Angular SSR, metadata, Open Graph, JSON-LD, sitemap, and robots.txt coverage.',
    },
    tagIds: ['seo', 'frontend', 'backend', 'content'],
  },
  {
    id: 'admin-workspaces',
    month: '2026-06',
    order: 20,
    title: {
      ru: 'Рабочие области контента стали взрослее',
      en: 'Content workspaces matured',
    },
    summary: {
      ru:
        'Модераторы, очередь вопросов, импорт из txt/csv/xlsx, редактор структуры ' +
        'матрицы и валидация статей перешли в защищённую админку.',
      en:
        'Moderators, the question queue, txt/csv/xlsx imports, the matrix structure ' +
        'editor, and article validation moved into the protected admin.',
    },
    tagIds: ['admin', 'frontend', 'backend', 'content', 'matrix'],
  },
  {
    id: 'quality-ops',
    month: '2026-06',
    order: 30,
    title: {
      ru: 'Качество и эксплуатация стали строже',
      en: 'Quality and operations became stricter',
    },
    summary: {
      ru:
        'Появились query-plan checks, Lighthouse gates, Trivy, pip-audit, Hadolint, ' +
        'Dockle, TaskIQ cache warm и hotswap-деплой с readiness health checks.',
      en:
        'Query-plan checks, Lighthouse gates, Trivy, pip-audit, Hadolint, Dockle, ' +
        'TaskIQ cache warming, and hotswap deploys with readiness health checks landed.',
    },
    tagIds: ['quality', 'security', 'infra', 'delivery'],
  },
  {
    id: 'angular-ui-migration',
    month: '2026-05',
    order: 10,
    title: {
      ru: 'Angular UI заменил прототип',
      en: 'Angular UI replaced the prototype',
    },
    summary: {
      ru:
        'Публичный интерфейс сайта переехал на Angular: матрица, статьи, интерфейсная ' +
        'локализация RU/EN, фильтры, аналитика просмотров и первые performance checks.',
      en:
        'The public site interface moved to Angular with the matrix, articles, RU/EN UI ' +
        'localization, filters, view analytics, and early performance checks.',
    },
    tagIds: ['frontend', 'content', 'matrix', 'localization', 'analytics'],
  },
  {
    id: 'angular-scaffold',
    month: '2026-04',
    order: 10,
    title: {
      ru: 'Начался Angular rewrite',
      en: 'Angular rewrite started',
    },
    summary: {
      ru:
        'Frontend получил Angular-структуру, окружения, typed API client, routing, ' +
        'базовый shell и первые компоненты матрицы.',
      en:
        'The frontend gained Angular structure, environments, a typed API client, routing, ' +
        'the base shell, and the first matrix components.',
    },
    tagIds: ['frontend', 'matrix'],
  },
  {
    id: 'auth-admin-foundation',
    month: '2026-01',
    order: 10,
    title: {
      ru: 'Появились auth, HTTPS и управление матрицей',
      en: 'Auth, HTTPS, and matrix administration landed',
    },
    summary: {
      ru:
        'Логин, logout, draft/publish действия, CRUD для вопросов матрицы, nginx ' +
        'subdomains и HTTPS стали частью рабочей версии проекта.',
      en:
        'Login, logout, draft/publish actions, matrix question CRUD, nginx subdomains, ' +
        'and HTTPS became part of the working project.',
    },
    tagIds: ['auth', 'backend', 'admin', 'matrix', 'security', 'infra'],
  },
  {
    id: 'editor-uploads',
    month: '2025-10',
    order: 10,
    title: {
      ru: 'Редактор получил загрузки и таблицу матрицы',
      en: 'Content editing gained uploads and a matrix table',
    },
    summary: {
      ru:
        'Контентный редактор получил presigned uploads через S3-compatible storage, ' +
        'генерацию имён файлов и табличное представление матрицы.',
      en:
        'The content editor gained presigned uploads through S3-compatible storage, ' +
        'file-name generation, and a table view for the competency matrix.',
    },
    tagIds: ['content', 'frontend', 'backend', 'matrix', 'infra'],
  },
  {
    id: 'architecture-docs',
    month: '2025-09',
    order: 10,
    title: {
      ru: 'Появились архитектурные документы, cache и Argon2',
      en: 'Architecture docs, cache, and Argon2 appeared',
    },
    summary: {
      ru:
        'ADRs, доменная документация, coverage badges, Valkey cache, Argon2 hashing, ' +
        'разделение auth-слоя и русская локализация админки задали базовые правила проекта.',
      en:
        'ADRs, domain documentation, coverage badges, Valkey cache, Argon2 hashing, ' +
        'auth-layer separation, and Russian admin localization set the project baseline.',
    },
    tagIds: ['infra', 'backend', 'security', 'auth', 'quality', 'localization'],
  },
  {
    id: 'blog-ci',
    month: '2025-08',
    order: 10,
    title: {
      ru: 'Появились блоговая модель и CI/CD',
      en: 'Blog model and CI/CD appeared',
    },
    summary: {
      ru:
        'Стартовали blog posts, GitHub Actions quality checks, coverage badges, ' +
        'deployment workflow и подготовка контейнеров для публикации.',
      en:
        'Blog posts, GitHub Actions quality checks, coverage badges, deployment workflow, ' +
        'and publication-oriented container work started.',
    },
    tagIds: ['content', 'delivery', 'quality', 'infra'],
  },
  {
    id: 'public-prototype',
    month: '2025-07',
    order: 10,
    title: {
      ru: 'Публичный прототип получил SEO и UX',
      en: 'Public Litestar prototype gained SEO and UX',
    },
    summary: {
      ru:
        'Litestar UI получил страницы матрицы, поиск, about page, светлую/тёмную тему, ' +
        'sitemap.xml, HTML sitemap, robots.txt, базовую SEO-разметку и Sentry.',
      en:
        'The Litestar UI gained matrix pages, search, the about page, light/dark theme, ' +
        'sitemap.xml, HTML sitemap, robots.txt, basic SEO markup, and Sentry.',
    },
    tagIds: ['backend', 'frontend', 'matrix', 'seo'],
  },
  {
    id: 'litestar-migration',
    month: '2025-06',
    order: 10,
    title: {
      ru: 'Backend переехал на Litestar',
      en: 'Backend moved to Litestar',
    },
    summary: {
      ru:
        'FastAPI был заменён на Litestar, публичный UI временно пошёл через шаблоны ' +
        'и HTMX, а админский и публичный контуры начали расходиться.',
      en:
        'FastAPI was replaced with Litestar, the public UI temporarily moved through ' +
        'templates and HTMX, and admin and public contours started to split.',
    },
    tagIds: ['backend', 'frontend'],
  },
  {
    id: 'backend-frontend-foundation',
    month: '2025-04',
    order: 10,
    title: {
      ru: 'Заложены backend, frontend и контейнеры',
      en: 'Backend, frontend, and container foundation',
    },
    summary: {
      ru:
        'Проект получил backend/frontend split, первые frontend связи с API, Docker ' +
        'Compose, auth tests, MinIO helpers и README для новой структуры.',
      en:
        'The project gained a backend/frontend split, the first frontend-to-API wiring, ' +
        'Docker Compose, auth tests, MinIO helpers, and README updates for the new shape.',
    },
    tagIds: ['backend', 'frontend', 'infra', 'auth'],
  },
  {
    id: 'matrix-admin-prototype',
    month: '2024-12',
    order: 10,
    title: {
      ru: 'Появился backend-прототип матрицы',
      en: 'Competency matrix backend prototype',
    },
    summary: {
      ru:
        'Админка, import/export и endpoints для листов, подразделов, фильтрации и ' +
        'деталей вопросов стали первыми рабочими контурами матрицы.',
      en:
        'Admin, import/export, and endpoints for sheets, subsections, filtering, and ' +
        'question details became the first working matrix contours.',
    },
    tagIds: ['backend', 'matrix', 'admin'],
  },
  {
    id: 'repository-started',
    month: '2024-09',
    order: 10,
    title: {
      ru: 'Репозиторий стартовал',
      en: 'Repository started',
    },
    summary: {
      ru:
        'Появилась первая версия проекта и базовый security pipeline; с этого началась ' +
        'история сайта.',
      en:
        'The first repository version and baseline security pipeline appeared; that is where ' +
        'the site history begins.',
    },
    tagIds: ['infra', 'security'],
  },
];

export function groupUpdateEntries(
  entries: readonly UpdateTimelineEntry[],
  language: LanguageCode,
  dateLocale: string,
): readonly UpdateGroup[] {
  const groups = new Map<string, UpdateTimelineEntry[]>();
  const sortedEntries = [...entries].sort(compareTimelineEntries);

  for (const entry of sortedEntries) {
    const groupEntries = groups.get(entry.month);
    if (groupEntries === undefined) {
      groups.set(entry.month, [entry]);
    } else {
      groupEntries.push(entry);
    }
  }

  return [...groups.entries()].map(([month, groupEntries]) => ({
    datetime: month,
    label: formatMonthLabel(month, dateLocale),
    entries: groupEntries.map((entry) => localizeEntry(entry, language)),
  }));
}

function localizeEntry(entry: UpdateTimelineEntry, language: LanguageCode): LocalizedUpdateEntry {
  return {
    id: entry.id,
    title: entry.title[language],
    summary: entry.summary[language],
    tagKeys: entry.tagIds.map((tagId) => UPDATE_TAG_I18N_KEYS[tagId]),
  };
}

function formatMonthLabel(month: string, dateLocale: string): string {
  const date = parseUpdateMonth(month);
  const parts = new Intl.DateTimeFormat(dateLocale, {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).formatToParts(date);
  const monthPart = requireDatePart(parts, 'month', month);
  const yearPart = requireDatePart(parts, 'year', month);
  return `${capitalizeFirstLetter(monthPart)} ${yearPart}`;
}

function parseUpdateMonth(month: string): Date {
  const match = /^(?<year>\d{4})-(?<month>\d{2})$/.exec(month);
  if (match?.groups === undefined) {
    throw new Error(`Invalid update month: ${month}`);
  }

  const year = Number.parseInt(match.groups['year'], 10);
  const monthIndex = Number.parseInt(match.groups['month'], 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error(`Invalid update month: ${month}`);
  }

  return new Date(Date.UTC(year, monthIndex, 1));
}

function requireDatePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
  month: string,
): string {
  const part = parts.find((item) => item.type === type);
  if (part === undefined) {
    throw new Error(`Cannot format update month: ${month}`);
  }
  return part.value;
}

function capitalizeFirstLetter(value: string): string {
  const firstLetter = value.charAt(0);
  if (firstLetter === '') {
    return value;
  }
  return firstLetter.toLocaleUpperCase() + value.slice(1);
}

function compareTimelineEntries(left: UpdateTimelineEntry, right: UpdateTimelineEntry): number {
  const monthOrder = right.month.localeCompare(left.month);
  if (monthOrder !== 0) {
    return monthOrder;
  }
  return left.order - right.order;
}
