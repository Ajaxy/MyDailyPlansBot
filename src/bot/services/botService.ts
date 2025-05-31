import { Bot, Context, GrammyError, HttpError } from 'grammy';
import { StateManager } from './stateManager';
import { SchedulerService } from './scheduler';
import { BotConfig } from '../types';

export class BotService {
  private bot: Bot;
  private stateManager: StateManager;
  private scheduler: SchedulerService;
  private config: BotConfig;

  constructor(config: BotConfig) {
    this.config = config;
    this.bot = new Bot(config.token);
    this.stateManager = new StateManager();
    this.scheduler = new SchedulerService(this.bot, this.stateManager, config.trackedUserIds);
    
    // Initialize scheduler with active chats from config
    config.activeChatIds.forEach(chatId => {
      this.scheduler.addChat(chatId);
      console.log(`Initialized active chat: ${chatId}`);
    });

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
          '👋 Hello! I\'m the MyDailyPlans bot. I\'ll send daily plan reminders to your team on working days at 6 AM GMT, ' +
          'with follow-ups every 3 hours until 3 PM GMT if team members haven\'t responded yet.\n\n' +
          '⚠️ Note: To receive reminders, this chat ID needs to be added to the ACTIVE_CHAT_IDS environment variable.'
        );
        
        // Show the chat ID for easy configuration
        await ctx.reply(`Chat ID: \`${chat.id}\``, { parse_mode: 'Markdown' });
      } else if (chatMember.new_chat_member.status === 'left' || chatMember.new_chat_member.status === 'kicked') {
        console.log(`Bot removed from chat: ${chat.id}`);
      }
    });

    // Handle /status command to check who has replied
    this.bot.command('status', async (ctx) => {
      if (ctx.chat.type === 'private') {
        await ctx.reply('This command only works in group chats.');
        return;
      }

      const chatId = ctx.chat.id;
      const isActiveChat = this.config.activeChatIds.includes(chatId);
      
      if (!isActiveChat) {
        await ctx.reply(
          '⚠️ This chat is not configured to receive reminders.\n\n' +
          `Chat ID: \`${chatId}\`\n` +
          'Add this ID to ACTIVE_CHAT_IDS environment variable to enable reminders.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const date = this.getCurrentDate();
      const repliedUsers = this.stateManager.getRepliedUsers(chatId, date);
      const unrepliedUsers = this.stateManager.getUnrepliedUsers(chatId, date, this.config.trackedUserIds);
      const reminderCount = this.stateManager.getReminderCount(chatId, date);

      let statusMessage = `📊 Daily Plans Status for ${date}:\n\n`;
      statusMessage += `✅ Replied: ${repliedUsers.size}/${this.config.trackedUserIds.length}\n`;
      statusMessage += `⏰ Reminders sent: ${reminderCount}/4\n`;

      if (unrepliedUsers.length > 0) {
        statusMessage += `\n⏳ Waiting for: ${unrepliedUsers.length} team members`;
      } else {
        statusMessage += '\n🎉 All team members have replied!';
      }

      await ctx.reply(statusMessage);
    });

    // Handle /help command
    this.bot.command('help', async (ctx) => {
      const helpMessage = `
🤖 *MyDailyPlans Bot Help*

This bot helps teams track daily plans with automatic reminders.

*How it works:*
• Every working day at 6 AM GMT, I'll ask for daily plans
• Follow-up reminders at 9 AM, 12 PM, and 3 PM GMT if needed
• I only track responses from configured team members

*Commands:*
/status - Check who has replied today
/help - Show this help message

*Setup:*
• Add this bot to your group chat
• Add the chat ID to ACTIVE_CHAT_IDS environment variable
• Configure team member IDs in TRACKED_USER_IDS
      `;

      await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    });

    // Handle messages from tracked users (moved to bottom to not interfere with commands)
    this.bot.on('message:text', async (ctx) => {
      const userId = ctx.from?.id;
      const chatId = ctx.chat.id;

      // Only track replies from specified users in configured group chats
      if (userId && 
          this.config.trackedUserIds.includes(userId) && 
          this.config.activeChatIds.includes(chatId) &&
          ctx.chat.type !== 'private') {
        
        const date = this.getCurrentDate();

        // Mark user as replied if they haven't already
        if (!this.stateManager.hasUserReplied(chatId, date, userId)) {
          this.stateManager.markUserReplied(chatId, date, userId);
          console.log(`User ${userId} replied with daily plan in chat ${chatId} for date ${date}`);

          // Check if everyone has replied
          const unrepliedUsers = this.stateManager.getUnrepliedUsers(chatId, date, this.config.trackedUserIds);
          if (unrepliedUsers.length === 0) {
            await ctx.reply('✅ Great! Everyone has shared their daily plans.');
          }
        }
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
    console.log(`Active chats configured: ${this.config.activeChatIds.join(', ')}`);
    console.log(`Tracked users configured: ${this.config.trackedUserIds.join(', ')}`);

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
