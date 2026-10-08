import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Bot, InlineKeyboard } from 'grammy';
import { config } from '../config';
import { WalletService } from '../wallet/wallet.service';

const DEPOSIT_PRESETS = [50, 100, 500, 1000];

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
      if (Number.isInteger(amount) && amount >= config.minDeposit) return this.sendInvoice(ctx.chat.id, ctx.from!.id, amount);
      const kb = new InlineKeyboard();
      DEPOSIT_PRESETS.forEach((a) => kb.text(`${a} ⭐`, `dep:${a}`));
      return ctx.reply('Сколько Stars внести?', { reply_markup: kb });
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
    bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));
    bot.on('message:successful_payment', async (ctx) => {
      const p = ctx.message.successful_payment;
      if (p.currency !== 'XTR') return;
      const m = /^dep:(\d+)$/.exec(p.invoice_payload);
      // trust only our own payload and the payer's real id, never a client-supplied amount
      if (!m || Number(m[1]) !== ctx.from.id) return this.log.error(`Bad payload ${p.invoice_payload}`);
      const fresh = await this.wallet.creditDeposit(ctx.from.id, p.total_amount, p.telegram_payment_charge_id);
      if (fresh) await ctx.reply(`✅ Зачислено ${p.total_amount} ⭐`, { reply_markup: play() });
    });

    // --- admin ---
    const admin = (ctx: any) => config.adminIds.includes(ctx.from?.id);
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
    return this.bot!.api.sendInvoice(chatId, 'Пополнение баланса', `${amount} ⭐ на игровой баланс`, `dep:${userId}`, 'XTR', [
      { label: `${amount} ⭐`, amount },
    ]);
  }

  async createDepositLink(userId: number, amount: number): Promise<string> {
    if (!this.bot) throw new Error('Bot is not configured');
    return this.bot.api.createInvoiceLink('Пополнение баланса', `${amount} ⭐ на игровой баланс`, `dep:${userId}`, '', 'XTR', [
      { label: `${amount} ⭐`, amount },
    ]);
  }

  async notifyAdmins(text: string) {
    if (!this.bot) return;
    await Promise.all(config.adminIds.map((id) => this.bot!.api.sendMessage(id, text).catch(() => {})));
  }
}
