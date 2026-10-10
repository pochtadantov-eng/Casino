import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Bot, InlineKeyboard } from 'grammy';
import { config } from '../config';
import { WalletService } from '../wallet/wallet.service';

const DEPOSIT_PRESETS = [50, 100, 500, 1000];
// invoice payload: dep:<userId>:<amount>. Both are re-checked at pre-checkout and at crediting, so a payload can never be used for another user or sum.
const parsePayload = (p: string) => { const m = /^dep:(\d+):(\d+)$/.exec(p); return m ? { userId: Number(m[1]), amount: Number(m[2]) } : null; };

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Bot');
  private bot: Bot | null = config.botToken ? new Bot(config.botToken) : null;

  constructor(private readonly wallet: WalletService) {}

  async onModuleInit() {
    const bot = this.bot;
    if (!bot) return this.log.warn('BOT_TOKEN is empty: Telegram bot disabled, API only');

    const play = () => new InlineKeyboard().webApp('🎰 Играть', config.webappUrl);

    bot.command('start', (ctx) =>
      ctx.reply('Добро пожаловать в Stars Casino! Ракета 🚀, Мины 💣, Башня 🏗 и Чайка 🕊. Пополняйте баланс в Telegram Stars ⭐.', {
        reply_markup: play(),
      }),
    );

    bot.command('balance', async (ctx) =>
      ctx.reply(`Баланс: ${await this.wallet.balance(ctx.from!.id)} ⭐`),
    );

    bot.command('deposit', (ctx) => {
      const amount = Number(ctx.match);
      if (Number.isInteger(amount) && amount >= config.minDeposit && amount <= config.maxDeposit) return this.sendInvoice(ctx.chat.id, ctx.from!.id, amount);
      const kb = new InlineKeyboard();
      DEPOSIT_PRESETS.filter((a) => a >= config.minDeposit && a <= config.maxDeposit).forEach((a) => kb.text(`${a} ⭐`, `dep:${a}`));
      return ctx.reply(`Сколько Stars внести? (от ${config.minDeposit} до ${config.maxDeposit}) Можно написать /deposit 250`, { reply_markup: kb });
    });
    bot.callbackQuery(/^dep:(\d+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.sendInvoice(ctx.chat!.id, ctx.from.id, Number(ctx.match[1]));
    });

    bot.command('withdraw', async (ctx) => {
      const amount = Number(ctx.match);
      if (!Number.isInteger(amount) || amount < config.minWithdraw) {
        return ctx.reply(`Использование: /withdraw <сумма>, минимум ${config.minWithdraw} ⭐`);
      }
      try {
        const id = await this.wallet.requestWithdraw(ctx.from!.id, amount);
        await this.notifyAdmins(`Withdrawal #${id}: user ${ctx.from!.id} wants ${amount} ⭐\n/approve ${id}  /reject ${id}`);
        return ctx.reply(`Заявка #${id} на вывод ${amount} ⭐ создана и ожидает проверки.`);
      } catch (e: any) {
        return ctx.reply(e.message === 'Insufficient balance' ? 'Недостаточно средств.' : 'Ошибка.');
      }
    });

    // --- Stars payments ---
    // Telegram asks the bot to confirm the order within 10 s; we re-check everything because the payload comes back from the client side.
    bot.on('pre_checkout_query', async (ctx) => {
      const q = ctx.preCheckoutQuery, p = parsePayload(q.invoice_payload);
      const bad = !p || q.currency !== 'XTR' || p.userId !== ctx.from.id || p.amount !== q.total_amount || p.amount < config.minDeposit || p.amount > config.maxDeposit;
      if (bad) return ctx.answerPreCheckoutQuery(false, 'Платёж не прошёл проверку, попробуйте создать счёт заново.');
      const u = await this.wallet.upsertUser({ id: ctx.from.id, username: ctx.from.username, first_name: ctx.from.first_name });
      if (u.banned) return ctx.answerPreCheckoutQuery(false, 'Аккаунт недоступен.');
      return ctx.answerPreCheckoutQuery(true);
    });
    bot.on('message:successful_payment', async (ctx) => {
      const pay = ctx.message.successful_payment;
      const p = parsePayload(pay.invoice_payload);
      // trust only our own payload and the payer's real id, never a client-supplied amount
      if (pay.currency !== 'XTR' || !p || p.userId !== ctx.from.id || p.amount !== pay.total_amount) {
        this.log.error(`Rejected payment ${pay.telegram_payment_charge_id}: payload ${pay.invoice_payload}, ${pay.total_amount} ${pay.currency}, from ${ctx.from.id}`);
        await this.notifyAdmins(`⚠️ Платёж ${pay.telegram_payment_charge_id} не зачислен автоматически (payload ${pay.invoice_payload}, ${pay.total_amount} ${pay.currency}, user ${ctx.from.id}). Проверьте вручную.`);
        return;
      }
      const fresh = await this.wallet.creditDeposit(ctx.from.id, pay.total_amount, pay.telegram_payment_charge_id);
      if (fresh) await ctx.reply(`✅ Зачислено ${pay.total_amount} ⭐\nБаланс: ${await this.wallet.balance(ctx.from.id)} ⭐`, { reply_markup: play() });
    });
    // the payer (or an admin) got the Stars back: take them off the balance too
    bot.on('message:refunded_payment', async (ctx) => {
      const r = ctx.message.refunded_payment;
      const done = await this.wallet.reverseDeposit(r.telegram_payment_charge_id);
      if (done) await this.notifyAdmins(`↩️ Возврат ${r.telegram_payment_charge_id}: user ${done.userId}, снято с баланса ${done.amount} из ${r.total_amount} ⭐`);
    });
    // Telegram requires a support command for bots that accept Stars
    bot.command('paysupport', (ctx) => ctx.reply('Вопросы по оплате: опишите проблему и приложите номер платежа (его видно в чеке Telegram). Мы ответим в этом чате. Если деньги списаны, но баланс не пополнился, возврат Stars делается по заявке.'));
    bot.command('terms', (ctx) => ctx.reply('Баланс хранится в Telegram Stars ⭐. Пополнение через счёт Telegram, вывод — по заявке (/withdraw, минимум ' + config.minWithdraw + ' ⭐). Играйте ответственно, 18+.'));

    // --- admin ---
    const admin = (ctx: any) => config.adminIds.includes(ctx.from?.id);
    // /refund <telegram_payment_charge_id>: returns the Stars to the payer through Telegram and takes the same amount off their balance
    bot.command('refund', async (ctx) => {
      if (!admin(ctx)) return;
      const chargeId = String(ctx.match).trim();
      const dep = chargeId ? await this.wallet.findDeposit(chargeId) : null;
      if (!dep) return ctx.reply('Использование: /refund <charge_id>. Платёж не найден среди зачисленных.');
      if (dep.refunded) return ctx.reply('Этот платёж уже возвращён.');
      try { await bot.api.refundStarPayment(dep.userId, chargeId); } catch (e: any) { return ctx.reply(`Telegram отказал: ${e.message}`); }
      const done = await this.wallet.reverseDeposit(chargeId);
      return ctx.reply(done ? `Возвращено ${dep.amount} ⭐ пользователю ${dep.userId}, с баланса снято ${done.amount}.` : 'Возврат сделан, баланс уже скорректирован.');
    });
    bot.command('gifts', async (ctx) => {
      if (!admin(ctx)) return;
      const rows = await this.wallet.pendingGifts();
      await ctx.reply(rows.length ? rows.map((r) => `#${r.id} user ${r.user_id}: ${r.gift}`).join('\n') + '\n\nОтметить выданным: /sent <id>' : 'Нет подарков к выдаче');
    });
    bot.command('sent', async (ctx) => {
      if (!admin(ctx)) return;
      const r = await this.wallet.markGiftSent(Number(ctx.match));
      if (!r) return ctx.reply('Не найдено или уже выдано');
      await bot.api.sendMessage(r.userId, '🎁 Ваш подарок из ежедневного сундука отправлен! Проверьте подарки в профиле Telegram.').catch(() => {});
      return ctx.reply('Готово');
    });
    bot.command('pending', async (ctx) => {
      if (!admin(ctx)) return;
      const rows = await this.wallet.pendingWithdrawals();
      await ctx.reply(rows.length ? rows.map((r) => `#${r.id} user ${r.user_id}: ${r.amount} ⭐`).join('\n') : 'Нет заявок');
    });
    for (const [cmd, approve] of [['approve', true], ['reject', false]] as const) {
      bot.command(cmd, async (ctx) => {
        if (!admin(ctx)) return;
        const r = await this.wallet.decideWithdraw(Number(ctx.match), approve);
        if (!r) return ctx.reply('Заявка не найдена или уже обработана');
        await bot.api.sendMessage(r.userId, approve ? `✅ Вывод ${r.amount} ⭐ одобрен.` : `❌ Вывод отклонён, ${r.amount} ⭐ возвращены на баланс.`).catch(() => {});
        return ctx.reply('Готово');
      });
    }

    bot.catch((e) => this.log.error(e.message));
    bot.start({ onStart: (me) => this.log.log(`Bot @${me.username} started`) }).catch((e) => this.log.error(e.message));
  }

  onModuleDestroy() {
    return this.bot?.stop();
  }

  private sendInvoice(chatId: number, userId: number, amount: number) {
    return this.bot!.api.sendInvoice(chatId, 'Пополнение баланса', `${amount} ⭐ на игровой баланс`, `dep:${userId}:${amount}`, 'XTR', [
      { label: `${amount} ⭐`, amount },
    ]);
  }

  async createDepositLink(userId: number, amount: number): Promise<string> {
    if (!this.bot) throw new Error('Bot is not configured');
    return this.bot.api.createInvoiceLink('Пополнение баланса', `${amount} ⭐ на игровой баланс`, `dep:${userId}:${amount}`, '', 'XTR', [
      { label: `${amount} ⭐`, amount },
    ]);
  }

  private giftCache: { at: number; list: { id: string; stars: number; emoji: string; limited: boolean }[] } | null = null;

  /** Regular Telegram gifts the bot can send (cached 10 min). Premium-only and sold-out gifts are left out. */
  async availableGifts() {
    if (!this.bot) throw new Error('Bot is not configured');
    if (this.giftCache && Date.now() - this.giftCache.at < 600_000) return this.giftCache.list;
    const { gifts } = await this.bot.api.getAvailableGifts();
    const list = gifts
      .filter((g) => !g.is_premium && g.remaining_count !== 0)
      .map((g) => ({ id: g.id, stars: g.star_count, emoji: g.sticker.emoji ?? '🎁', limited: g.total_count != null }))
      .sort((a, b) => a.stars - b.stars);
    this.giftCache = { at: Date.now(), list };
    return list;
  }

  /** Personal mode: this player's gifts are only drawn by their PampGram client, no real gift is sent. */
  isVisualGiftUser(userId: number) {
    return !!config.visualGiftToken && config.visualGiftUserIds.includes(userId);
  }

  /** The gift appears in the player's chat with the bot as a real Telegram gift message (or, for the visual-gift owner, as a queued local gift). */
  async sendGift(userId: number, giftId: string, text: string) {
    if (!this.bot) throw new Error('Bot is not configured');
    if (this.isVisualGiftUser(userId)) {
      await this.wallet.queueVisualGift(userId, giftId, text.slice(0, 128), config.visualGiftDelaySec);
      await this.bot.api.sendMessage(userId, 'Подарок придёт в течение минуты 🎁').catch(() => {});
      return;
    }
    await this.bot.api.sendGift(userId, giftId, { text: text.slice(0, 128) });
  }

  async notifyAdmins(text: string) {
    if (!this.bot) return;
    await Promise.all(config.adminIds.map((id) => this.bot!.api.sendMessage(id, text).catch(() => {})));
  }
}
