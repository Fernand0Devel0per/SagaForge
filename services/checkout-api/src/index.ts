import { env } from './config/env.js';
import { buildServer } from './http/server.js';

const app = buildServer();

app.listen(env.PORT, () => {
  console.log(`${env.SERVICE_NAME} listening on :${env.PORT} (env=${env.ENV})`);
});

