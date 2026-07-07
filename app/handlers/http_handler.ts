import { Elysia } from 'elysia'
import { handleKickWebhook } from './webhook_handler';
import { HTTP_SERVER_PORT, KICK_WEBHOOK_PATH } from '../config';
import { adminApi } from './admin_api';

export async function startHTTPServer() {
  const app = new Elysia()
    .use(adminApi)
    .post(KICK_WEBHOOK_PATH, async ({ request, set }) => {
      const rawBody = await request.text()

      const result = await handleKickWebhook({
          rawBody,
          headers: request.headers,
      });

      set.status = result.status;
      return result.body;
    })
    .listen(HTTP_SERVER_PORT)

  console.log("HTTP server started on port " + HTTP_SERVER_PORT)
}
