interface FileSystemModule {
  readFileSync(path: string, encoding: 'utf8'): string;
}

interface AngularConfig {
  projects: {
    'competency-trainer-frontend': {
      architect: { build: { options: { assets: unknown[] } } };
    };
  };
}

declare const require: (path: string) => unknown;

const fileSystem = require('node:fs') as FileSystemModule;

describe('theme preload script', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-bs-theme');
  });

  it('applies the stored theme before Angular renders the app root', () => {
    const html = readIndexHtml();
    const themeScript = extractThemeScript(html);

    expect(themeScript.index).toBeGreaterThan(html.indexOf('<head>'));
    expect(themeScript.index).toBeLessThan(html.indexOf('<body>'));
    expect(themeScript.source).toBe('assets/design-system/theme-preload.js');
    expect(themeScript.tag).toContain('nonce="__CSP_NONCE__"');

    localStorage.setItem('chosenTheme', 'dark');
    document.documentElement.setAttribute('data-bs-theme', 'light');
    executeScript(readThemePreloadScript());

    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });

  it('copies the package preload script to the URL used by the document', () => {
    const angularConfig = JSON.parse(
      fileSystem.readFileSync('angular.json', 'utf8'),
    ) as AngularConfig;

    expect(
      angularConfig.projects['competency-trainer-frontend'].architect.build.options.assets,
    ).toContainEqual({
      glob: 'theme-preload.js',
      input: 'node_modules/@alittlemore.dev/design-system',
      output: '/assets/design-system',
    });
  });
});

function readIndexHtml(): string {
  return fileSystem.readFileSync('src/index.html', 'utf8');
}

function extractThemeScript(html: string): { source: string; tag: string; index: number } {
  const source = 'assets/design-system/theme-preload.js';
  const sourceIndex = html.indexOf(source);
  expect(sourceIndex).toBeGreaterThanOrEqual(0);

  const scriptStart = html.lastIndexOf('<script', sourceIndex);
  const scriptEnd = html.indexOf('>', sourceIndex);
  expect(scriptStart).toBeGreaterThanOrEqual(0);
  expect(scriptEnd).toBeGreaterThan(scriptStart);

  return {
    source,
    tag: html.slice(scriptStart, scriptEnd + 1),
    index: scriptStart,
  };
}

function readThemePreloadScript(): string {
  return fileSystem.readFileSync(
    'node_modules/@alittlemore.dev/design-system/theme-preload.js',
    'utf8',
  );
}

function executeScript(script: string): void {
  const run = new Function(script);
  run();
}
