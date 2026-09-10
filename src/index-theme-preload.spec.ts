interface FileSystemModule {
  readFileSync(path: string, encoding: 'utf8'): string;
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

    localStorage.setItem('chosenTheme', 'dark');
    document.documentElement.setAttribute('data-bs-theme', 'light');
    executeScript(themeScript.text);

    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });
});

function readIndexHtml(): string {
  return fileSystem.readFileSync('src/index.html', 'utf8');
}

function extractThemeScript(html: string): { text: string; index: number } {
  const markerIndex = html.indexOf('chosenTheme');
  expect(markerIndex).toBeGreaterThanOrEqual(0);

  const scriptStart = html.lastIndexOf('<script', markerIndex);
  const scriptEnd = html.indexOf('</script>', markerIndex);
  const scriptTagEnd = html.indexOf('>', scriptStart);
  expect(scriptStart).toBeGreaterThanOrEqual(0);
  expect(scriptTagEnd).toBeGreaterThan(scriptStart);
  expect(scriptEnd).toBeGreaterThan(scriptStart);

  return {
    text: html.slice(scriptTagEnd + 1, scriptEnd),
    index: scriptStart,
  };
}

function executeScript(script: string): void {
  const run = new Function(script);
  run();
}
