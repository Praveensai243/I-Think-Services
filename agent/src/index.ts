import { createServer } from "./server.js";
import { env, hasBrain, usingGoogle, business } from "./config.js";

const app = createServer();

app.listen(env.port, () => {
  console.log(`\n  ${business.name} — AI receptionist`);
  console.log(`  ▸ http://localhost:${env.port}  (browser voice demo)`);
  console.log(`  ▸ brain:    ${hasBrain ? `Claude (${env.model})` : "DEMO MODE — set ANTHROPIC_API_KEY to enable"}`);
  console.log(`  ▸ calendar: ${usingGoogle ? "Google Calendar" : "mock (in-memory)"}`);
  console.log(`  ▸ phone webhook: POST ${env.publicBaseUrl}/api/vapi/function`);
  console.log(`  ▸ vapi config:   GET  ${env.publicBaseUrl}/api/vapi/assistant\n`);
});
