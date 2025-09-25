import { Bot, GrammyError, HttpError } from 'grammy';
import { SchedulerService } from './SchedulerService';
import { UserService } from './UserService';
import { PlanService } from './PlanService';
import { ReminderService } from './ReminderService';
import { DutyReminderService } from './DutyReminderService';
import { OffService } from './OffService';
import { BotConfig } from '../types';
import { User } from '../entities';

export class BotService {
  private bot: Bot;
  private planService: PlanService;
  private reminderService: ReminderService;
  private scheduler: SchedulerService;
  private userService: UserService;
  private dutyReminderService: DutyReminderService;
  private offService: OffService;
  private config: BotConfig;

  constructor(config: BotConfig) {
    this.config = config;
    this.bot = new Bot(config.token);
    this.planService = new PlanService();
    this.reminderService = new ReminderService();
    this.userService = new UserService();
    this.offService = new OffService();
    this.dutyReminderService = new DutyReminderService(this.bot, this.userService);
    this.scheduler = new SchedulerService(this.bot,
      this.planService,
      this.reminderService,
      this.userService,
      this.dutyReminderService);

    this.setupHandlers();
    this.setupErrorHandling();
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

  public getPlanService(): PlanService {
    return this.planService;
  }

  public getReminderService(): ReminderService {
    return this.reminderService;
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

  // For manual PR reminder triggering in development
  public async triggerPrReminder(): Promise<void> {
    console.log('Manually triggering PR reminders...');
    const scheduler = this.getScheduler();
    await scheduler.sendPrReminders();
  }

  // For manual duty reminder triggering in development
  public async triggerDutyReminder(): Promise<void> {
    console.log('Manually triggering duty reminders...');
    await this.dutyReminderService.sendDutyReminders();
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
          '\n/remind_pr - Отправить напоминания о PR' +
          '\n/help - Показать справку',
          { parse_mode: 'Markdown' },
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
            'Обратитесь к администратору для настройки отслеживания участников команды.',
          );
          return;
        }

        const date = this.getCurrentDate();
        const repliedUserIds = await this.planService.getRepliedUserIds(chatId, date);
        const trackedUserIds = trackedUsers.map((u: User) => u.telegramId);
        const unrepliedUserIds = await this.planService.getUnrepliedUserIds(chatId, date, trackedUserIds);
        const reminderCount = await this.reminderService.getReminderCount(chatId, date);

        let statusMessage = `📊 Статус ежедневных планов на ${date}:`;
        statusMessage += `\n\n⏰ Отправлено напоминаний: ${reminderCount}/4`;
        statusMessage += `\n✅ Ответили: ${repliedUserIds.length}/${trackedUsers.length}`;

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

    // Handle /remind_pr command to manually trigger PR reminders
    this.bot.command('remind_pr', async (ctx) => {
      if (ctx.chat.type === 'private') {
        await ctx.reply('Эта команда работает только в групповых чатах.');
        return;
      }

      const chatId = ctx.chat.id;

      try {
        await ctx.reply('🔄 Проверяю PR для этого чата...');

        // Send PR reminder only for this specific chat
        const prReminderService = this.scheduler.getPrReminderService();
        await prReminderService.sendPrReminderToChat(chatId);

        // Note: Success/no PRs message will be sent by the PR reminder service itself
      } catch (error) {
        console.error('Error sending PR reminders:', error);
        await ctx.reply('❌ Ошибка при отправке напоминаний о PR.');
      }
    });

    // Handle /remind_duty command to manually trigger duty reminders
    this.bot.command('remind_duty', async (ctx) => {
      if (ctx.chat.type === 'private') {
        await ctx.reply('Эта команда работает только в групповых чатах.');
        return;
      }

      const chatId = ctx.chat.id;

      // Only allow in the specific duty chat
      if (chatId !== -1001783045675) {
        await ctx.reply('Напоминания о дежурстве доступны только в специальном чате.');
        return;
      }

      try {
        await ctx.reply('🔄 Проверяю дежурство на сегодня...');

        // Send duty reminder only for this specific chat
        await this.dutyReminderService.sendDutyReminderToChat(chatId);

      } catch (error) {
        console.error('Error sending duty reminder:', error);
        await ctx.reply('❌ Ошибка при отправке напоминания о дежурстве.');
      }
    });

    // Handle /off command to register user's absence
    this.bot.command('off', async (ctx) => {
      if (ctx.chat.type === 'private') {
        await ctx.reply('Эта команда работает только в групповых чатах.');
        return;
      }

      const chatId = ctx.chat.id;
      const commandText = ctx.message?.text || '';
      const parts = commandText.split(' ').slice(1); // Remove /off

      try {
        // Parse the command arguments
        let username: string | undefined;
        let dateRange: string;

        // Check if first argument is a username (starts with @)
        if (parts.length > 0 && parts[0].startsWith('@')) {
          username = parts[0].substring(1); // Remove @ symbol
          dateRange = parts.slice(1).join(' ');
        } else {
          // No username specified, use current sender
          username = ctx.from?.username;
          dateRange = parts.join(' ');
        }

        if (!username) {
          await ctx.reply('❌ Не удалось определить пользователя. Убедитесь, что у вас есть username в Telegram.');
          return;
        }

        // Find the user in the database
        const user = await this.userService.getUserByUsernameAndChat(username, chatId);
        if (!user) {
          await ctx.reply(`❌ Пользователь @${username} не найден в этом чате. Убедитесь, что пользователь зарегистрирован.`);
          return;
        }

        // Parse dates
        let fromDate: Date;
        let toDate: Date;

        if (!dateRange || dateRange.trim() === '') {
          // No dates specified, default to today
          fromDate = new Date();
          toDate = new Date();
          fromDate.setHours(0, 0, 0, 0);
          toDate.setHours(0, 0, 0, 0);
        } else if (dateRange.includes('-')) {
          // Date range specified
          const [fromStr, toStr] = dateRange.split('-').map(s => s.trim());
          
          if (!fromStr || fromStr === '') {
            // Only end date specified, start from today
            fromDate = new Date();
            fromDate.setHours(0, 0, 0, 0);
          } else {
            const parsedFrom = this.parseDate(fromStr);
            if (!parsedFrom) {
              await ctx.reply('❌ Неверный формат даты начала. Используйте формат ДД.ММ[.ГГГГ].');
              return;
            }
            fromDate = parsedFrom;
          }

          if (!toStr || toStr === '') {
            await ctx.reply('❌ Не указана дата окончания. Используйте формат: /off [@username] [dateFrom-]dateTo');
            return;
          }

          const parsedTo = this.parseDate(toStr);
          if (!parsedTo) {
            await ctx.reply('❌ Неверный формат даты окончания. Используйте формат ДД.ММ[.ГГГГ].');
            return;
          }
          toDate = parsedTo;
        } else {
          // Single date specified
          const parsedDate = this.parseDate(dateRange);
          if (!parsedDate) {
            await ctx.reply('❌ Неверный формат даты. Используйте формат ДД.ММ[.ГГГГ] или ДД.ММ-ДД.ММ для диапазона.');
            return;
          }
          fromDate = new Date(parsedDate);
          toDate = new Date(parsedDate);
        }

        // Ensure fromDate is not after toDate
        if (fromDate > toDate) {
          await ctx.reply('❌ Дата начала не может быть позже даты окончания.');
          return;
        }

        // Create the off record
        await this.offService.createOff(user.id, chatId, fromDate, toDate);

        // Format dates for display
        const fromStr = this.formatDate(fromDate);
        const toStr = this.formatDate(toDate);
        
        if (fromStr === toStr) {
          await ctx.reply(`✅ Добавлено отсутствие для @${username} на ${fromStr}`);
        } else {
          await ctx.reply(`✅ Добавлено отсутствие для @${username} с ${fromStr} по ${toStr}`);
        }

      } catch (error) {
        console.error('Error handling /off command:', error);
        await ctx.reply('❌ Произошла ошибка при добавлении отсутствия.');
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
/remind_pr - Отправить напоминания о PR вручную
/remind_duty - Отправить напоминание о дежурстве
/off - Добавить отсутствие
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
      const messageId = ctx.message.message_id;
      const messageText = ctx.message.text;

      if (!userId || !username || !messageText) return;

      try {
        // Check if this is a tracked user in this chat
        const isTracked = await this.userService.isUserActiveInChat(userId, chatId);

        if (isTracked) {
          await this.userService.upsertUser(userId, chatId, username);
        }

        // Only track replies from specified users in group chats
        if (isTracked && ctx.chat.type !== 'private') {
          const date = this.getCurrentDate();

          // Check if user has already replied today
          const hasReplied = await this.planService.hasUserReplied(chatId, date, userId);

          if (!hasReplied) {
            // Save the plan to database
            await this.planService.insertPlan(userId, chatId, date, messageId, messageText);
            console.log(`User ${userId} replied with daily plan in chat ${chatId} for date ${date}`);

            // Check if everyone has replied
            const trackedUserIds = await this.userService.getTrackedUserIdsForChat(chatId);
            const unrepliedUserIds = await this.planService.getUnrepliedUserIds(chatId, date, trackedUserIds);

            if (unrepliedUserIds.length === 0) {
              await ctx.reply('✅ Отлично! Все поделились своими планами на день.');
            }
          } else {
            // User already replied today, save additional plan but don't send confirmation
            await this.planService.insertPlan(userId, chatId, date, messageId, messageText);
            console.log(`User ${userId} sent additional daily plan in chat ${chatId} for date ${date}`);
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

  /**
   * Parse date from DD.MM[.YYYY] format
   */
  private parseDate(dateStr: string): Date | null {
    // Remove any whitespace
    dateStr = dateStr.trim();
    
    // Split by dots
    const parts = dateStr.split('.');
    
    if (parts.length < 2 || parts.length > 3) {
      return null;
    }
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parts.length === 3 ? parseInt(parts[2], 10) : new Date().getFullYear();
    
    // Validate values
    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      return null;
    }
    
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) {
      return null;
    }
    
    // Create date (month is 0-indexed in JavaScript)
    const date = new Date(year, month - 1, day);
    
    // Check if the date is valid (e.g., not Feb 31)
    if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
      return null;
    }
    
    // Set time to start of day
    date.setHours(0, 0, 0, 0);
    
    return date;
  }

  /**
   * Format date to DD.MM.YYYY
   */
  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }
} 