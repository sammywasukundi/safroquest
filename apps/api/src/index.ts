import { buildApp } from './app.ts';
import { config } from './config.ts';

const app = buildApp();
app.listen({ port: config.port, host: '0.0.0.0' }).then(() => {
  console.log(`SafroQuest API on http://localhost:${config.port}  (dev admin: ${config.devAdmin ? 'first account becomes admin' : 'off'})`);
}).catch((e) => { console.error(e); process.exit(1); });
