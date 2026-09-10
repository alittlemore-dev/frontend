import { startSsrFixture } from './ssr_mock_app.mjs';

const LHCI_PORT = 4210;

let fixture;

try {
  fixture = await startSsrFixture({ frontendPort: LHCI_PORT });
  console.log(`LHCI server ready on http://127.0.0.1:${fixture.frontendPort}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function shutdown() {
  try {
    await fixture?.close();
  } finally {
    process.exit(0);
  }
}
