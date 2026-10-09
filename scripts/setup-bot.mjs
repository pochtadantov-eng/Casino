// One-time (and re-runnable) Telegram setup + payment pre-flight check.
//   node --env-file=.env scripts/setup-bot.mjs        (or: npm run setup:bot)
// It never moves money: the only "payment" call is creating an invoice LINK for 50 Stars, which nobody pays.
const { BOT_TOKEN, WEBAPP_URL } = process.env;
const fail = (m) => { console.error('✗ ' + m); process.exit(1); };
if (!BOT_TOKEN) fail('BOT_TOKEN is empty. Create a bot in @BotFather (/newbot) and put the token into .env');
if (!WEBAPP_URL || !/^https:\/\//.test(WEBAPP_URL)) fail('WEBAPP_URL must be the public HTTPS address of this server, e.g. https://casino.example.com');

const call = async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`${method}: ${j.description || r.status}`);
  return j.result;
};
const step = async (title, fn) => { try { const out = await fn(); console.log('✓ ' + title + (out ? ' — ' + out : '')); } catch (e) { fail(`${title} — ${e.message}`); } };

await step('Bot token is valid', async () => { const me = await call('getMe'); return `@${me.username}`; });
await step('Commands registered', async () => { await call('setMyCommands', { commands: [
  { command: 'start', description: 'Открыть казино' }, { command: 'deposit', description: 'Пополнить баланс Stars' }, { command: 'balance', description: 'Мой баланс' },
  { command: 'withdraw', description: 'Заявка на вывод' }, { command: 'paysupport', description: 'Помощь по платежам' }, { command: 'terms', description: 'Условия' } ] }); });
await step('Mini App button in the chat menu', async () => { await call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Играть', web_app: { url: WEBAPP_URL } } }); return WEBAPP_URL; });
await step('Webhook cleared (the bot uses long polling)', async () => { await call('deleteWebhook', { drop_pending_updates: false }); });
await step('Telegram Stars invoices work for this bot', async () => {
  const link = await call('createInvoiceLink', { title: 'Проверка', description: 'Тестовый счёт, оплачивать не нужно', payload: 'dep:0:50', provider_token: '', currency: 'XTR', prices: [{ label: '50 ⭐', amount: 50 }] });
  return link;
});
try { const res = await fetch(WEBAPP_URL.replace(/\/$/, '') + '/api/me'); console.log(res.status === 401 || res.ok ? `✓ ${WEBAPP_URL} answers (API is up)` : `! ${WEBAPP_URL}/api/me answered HTTP ${res.status} - is the server running behind this address?`); }
catch (e) { console.log(`! Cannot reach ${WEBAPP_URL}: ${e.message}`); }

console.log(`
Next steps (only you can do these in Telegram):
 1. @BotFather → /mybots → your bot → Bot Settings → Configure Mini App → Enable Mini App → set the URL to ${WEBAPP_URL}
 2. Put your own Telegram id into ADMIN_IDS in .env (you get /pending /approve /refund /gifts commands and withdrawal alerts).
 3. Start the server (docker compose up -d --build), open the bot, press "Играть", tap + next to the balance and pay a small amount (50 ⭐).
 4. The balance should grow by the same amount within a few seconds; /refund <charge_id> returns a test payment.
`);
