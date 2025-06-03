import { Bot, Context, GrammyError, HttpError } from 'grammy';
import { StateManager } from './stateManager';
import { SchedulerService } from './scheduler';
import { UserService } from './UserService';
import { BotConfig } from '../types';
import { User } from '../entities';

export class BotService {
  private bot: Bot;
  private stateManager: StateManager;
  private scheduler: SchedulerService;
  private userService: UserService;
  private config: BotConfig;

  constructor(config: BotConfig) {
    this.config = config;
    this.bot = new Bot(config.token);
    this.stateManager = new StateManager();
    this.userService = new UserService();
    this.scheduler = new SchedulerService(this.bot, this.stateManager, this.userService);

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers(): void {
    // Handle when bot is added to/removed from a group (informational only)
    this.bot.on('my_chat_member', async (ctx) => {
      const chatMember = ctx.myChatMember;
      const chat = ctx.chat;

      if (chatMember.new_chat_member.status === 'member' || chatMember.new_chat_member.status === 'administrator') {
        console.log(`Bot added to chat: ${chat.id} (${chat.title || 'Private chat'})`);

        await ctx.reply(
          '👋 Привет! Я бот *MyDailyPlans*, помогаю всем быть в курсе ежедневных планов команды.' +
          '\n\nБуду напоминать рассказывать о планах на день: в рабочие дни в 6:00 GMT, с несколькими повторениями до 15:00 GMT.' +
          '\n\n*Команды:*' +
          '\n/status - Проверить статус ответов' +
          '\n/help - Показать справку',
          { parse_mode: 'Markdown' }
        );
      } else if (chatMember.new_chat_member.status === 'left' || chatMember.new_chat_member.status === 'kicked') {
        console.log(`Bot removed from chat: ${chat.id}`);
      }
    });

    // Handle /status command to check who has replied
    this.bot.command('status', async (ctx) => {
      if (ctx.chat.type === 'private') {
        await ctx.reply('Эта команда работает только в групповых чатах.');
        return;
      }

      const chatId = ctx.chat.id;

      try {
        const trackedUsers = await this.userService.getActiveUsersForChat(chatId);

        if (trackedUsers.length === 0) {
          await ctx.reply(
            '⚠️ В этом чате нет отслеживаемых пользователей.\n\n' +
            'Обратитесь к администратору для настройки отслеживания участников команды.'
          );
          return;
        }

        const date = this.getCurrentDate();
        const repliedUserIds = this.stateManager.getRepliedUserIds(chatId, date);
        const trackedUserIds = trackedUsers.map((u: User) => u.telegramId);
        const unrepliedUserIds = this.stateManager.getUnrepliedUserIds(chatId, date, trackedUserIds);
        const reminderCount = this.stateManager.getReminderCount(chatId, date);

        let statusMessage = `📊 Статус ежедневных планов на ${date}:`;
        statusMessage += `\n\n⏰ Отправлено напоминаний: ${reminderCount}/4`;
        statusMessage += `\n✅ Ответили: ${repliedUserIds.size}/${trackedUsers.length}`;

        if (unrepliedUserIds.length > 0) {
          statusMessage += `\n⏳ Ожидаем ответов: ${unrepliedUserIds.length}`;
        } else {
          statusMessage += '\n🎉 Все участники команды ответили!';
        }

        await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error getting status:', error);
        await ctx.reply('❌ Ошибка при получении статуса.');
      }
    });

    // Handle /help command
    this.bot.command('help', async (ctx) => {
      const helpMessage = `
🤖 *Справка MyDailyPlans Bot*

Этот бот помогает всем быть в курсе ежедневных планов команды.

*Как это работает:*
• Каждый рабочий день в 6:00 GMT я спрашиваю о планах на день.
• Повторные напоминания в 9:00, 12:00 и 15:00 GMT при необходимости.
• Я отслеживаю ответы только от настроенных участников команды.

*Команды:*
/status - Проверить, кто ответил сегодня
/help - Показать эту справку

*Настройка:*
• Добавьте этого бота в ваш групповой чат.
• Обратитесь к администратору для настройки отслеживания участников.
      `;

      await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    });

    // Handle messages from tracked users (moved to bottom to not interfere with commands)
    this.bot.on('message:text', async (ctx) => {
      const userId = ctx.from?.id;
      const chatId = ctx.chat.id;
      const username = ctx.from?.username;

      if (!userId || !username) return;

      try {
        // Check if this is a tracked user in this chat
        const isTracked = await this.userService.isUserActiveInChat(userId, chatId);

        if (isTracked) {
          await this.userService.upsertUser(userId, chatId, username);
        }

        // Only track replies from specified users in group chats
        if (isTracked && ctx.chat.type !== 'private') {
          const date = this.getCurrentDate();

          // Mark user as replied if they haven't already
          if (!this.stateManager.hasUserReplied(chatId, date, userId)) {
            this.stateManager.markUserReplied(chatId, date, userId);
            console.log(`User ${userId} replied with daily plan in chat ${chatId} for date ${date}`);

            // Check if everyone has replied
            const trackedUserIds = await this.userService.getTrackedUserIdsForChat(chatId);
            const unrepliedUserIds = this.stateManager.getUnrepliedUserIds(chatId, date, trackedUserIds);

            if (unrepliedUserIds.length === 0) {
              await ctx.reply('✅ Отлично! Все поделились своими планами на день.');
            }
          }
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });
  }

  private setupErrorHandling(): void {
    this.bot.catch((err) => {
      const ctx = err.ctx;
      console.error(`Error while handling update ${ctx.update.update_id}:`);
      const e = err.error;

      if (e instanceof GrammyError) {
        console.error('Error in request:', e.description);
      } else if (e instanceof HttpError) {
        console.error('Could not contact Telegram:', e);
      } else {
        console.error('Unknown error:', e);
      }
    });
  }

  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  public async start(): Promise<void> {
    console.log('Starting MyDailyPlans bot...');

    try {
      const activeChatIds = await this.userService.getActiveChatIds();
      console.log(`Active chats configured: ${activeChatIds.join(', ')}`);
    } catch (error) {
      console.log('No active chats found in database');
    }

    // Start the scheduler
    this.scheduler.start();

    // Start the bot
    await this.bot.start();
    console.log('MyDailyPlans bot started successfully');
  }

  public async stop(): Promise<void> {
    console.log('Stopping MyDailyPlans bot...');
    await this.bot.stop();
    console.log('MyDailyPlans bot stopped');
  }

  // For testing purposes
  public getBot(): Bot {
    return this.bot;
  }

  public getStateManager(): StateManager {
    return this.stateManager;
  }

  public getScheduler(): SchedulerService {
    return this.scheduler;
  }

  public getUserService(): UserService {
    return this.userService;
  }

  // For manual reminder triggering in development
  public async triggerReminder(hour?: number): Promise<void> {
    console.log('Manually triggering reminders...');
    const scheduler = this.getScheduler();

    // Use provided hour or current time to determine reminder type
    const targetHour = hour !== undefined ? hour : new Date().getHours();

    if (targetHour === 6) {
      // Trigger initial reminder
      console.log('Triggering initial reminder (6 AM type)');
      await scheduler.sendInitialReminder();
    } else {
      // Trigger follow-up reminder
      console.log('Triggering follow-up reminder');
      await scheduler.sendFollowUpReminder();
    }
  }
}
