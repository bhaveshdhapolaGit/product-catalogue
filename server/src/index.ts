// Entry point of the API: read the settings, build the services, start the web server.
import { createApp } from './app';
import { loadConfig } from './config';
import { createServices } from './container';

const config = loadConfig();
const { catalogue, enquiries } = createServices(config);
const app = createApp({ catalogue, enquiries, trustProxy: config.TRUST_PROXY });

const server = app.listen(config.PORT, () => {
  console.log(`API listening on port ${config.PORT}`);
});

// Shut down cleanly when asked to (Docker sends SIGTERM when stopping, Ctrl+C sends SIGINT):
// stop taking new requests, let the current ones finish, then exit.
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
