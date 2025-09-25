import * as cron from 'node-cron';
import { Bot } from 'grammy';
import { UserService } from './UserService';
import { PlanService } from './PlanService';
import { ReminderService } from './ReminderService';
import { GitHubService } from './GitHubService';
import { PrReminderService } from './PrReminderService';
import { RepositoryService } from './RepositoryService';
import { DutyReminderService } from './DutyReminderService';
import { REMINDER_SCHEDULE, WORKING_DAYS } from '../types';
import { User } from '../entities';

export class SchedulerService {
  private planService: PlanService;
  private reminderService: ReminderService;
  private bot: Bot;
  private userService: UserService;
  private prReminderService: PrReminderService;
  private dutyReminderService: DutyReminderService;

  constructor(bot: Bot, planService: PlanService, reminderService: ReminderService, userService: UserService, dutyReminderService: DutyReminderService) {
    this.bot = bot;
    this.planService = planService;
    this.reminderService = reminderService;
    this.userService = userService;
    this.dutyReminderService = dutyReminderService;
    
    // Initialize GitHub and PR reminder services
    const repositoryService = new RepositoryService();
    const githubService = new GitHubService(repositoryService);
    this.prReminderService = new PrReminderService(bot, githubService, userService);
  }

  public start(): void {
    // Initial reminder at 6:00 AM GMT on working days
    cron.schedule('0 6 * * 1-5', async () => {
      await this.sendInitialReminder();
    }, {
      timezone: 'GMT'
    });

    // Follow-up reminders every 3 hours: 9:00, 12:00, 15:00 GMT
    cron.schedule('0 9,12,15 * * 1-5', async () => {
      await this.sendFollowUpReminder();
    }, {
      timezone: 'GMT'
    });

    // PR reminders at 10:00 and 16:00 GMT every day
    cron.schedule('0 10,16 * * *', async () => {
      await this.sendPrReminders();
    }, {
      timezone: 'GMT'
    });

    // Duty reminders at 12:00 AM (00:00) GMT every day
    cron.schedule('0 0 * * *', async () => {
      await this.sendDutyReminders();
    }, {
      timezone: 'GMT'
    });

    console.log('Daily plan reminder scheduler started');
    console.log('PR reminder scheduler started (10:00 and 16:00 GMT)');
    console.log('Duty reminder scheduler started (12:00 AM GMT daily)');
  }

  private getCurrentDate(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  public async sendInitialReminder(): Promise<void> {
    const date = this.getCurrentDate();
    
    try {
      const activeChatIds = await this.userService.getActiveChatIds();

      for (const chatId of activeChatIds) {
        try {
          const reminderCount = await this.reminderService.getReminderCount(chatId, date);

          // Reset state for new day if it's the first reminder
          if (reminderCount === 0) {
            await this.reminderService.resetReminderState(chatId, date);
          }

          const message = this.getInitialReminderMessage();
          await this.bot.api.sendMessage(chatId, message);
          await this.reminderService.incrementReminderCount(chatId, date);

          console.log(`Sent initial reminder to chat ${chatId} for date ${date}`);
        } catch (error) {
          console.error(`Error sending initial reminder to chat ${chatId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error getting active chat IDs:', error);
    }
  }

  public async sendFollowUpReminder(): Promise<void> {
    const date = this.getCurrentDate();

    try {
      const activeChatIds = await this.userService.getActiveChatIds();

      for (const chatId of activeChatIds) {
        try {
          const reminderCount = await this.reminderService.getReminderCount(chatId, date);

          // Only send follow-up if we haven't exceeded the limit (4 total reminders)
          if (reminderCount >= 4) {
            continue;
          }

          const trackedUserIds = await this.userService.getTrackedUserIdsForChat(chatId);
          const unrepliedUserIds = await this.planService.getUnrepliedUserIds(chatId, date, trackedUserIds);

          // Skip if everyone has replied
          if (unrepliedUserIds.length === 0) {
            continue;
          }

          const message = await this.getFollowUpReminderMessage(chatId, unrepliedUserIds);
          await this.bot.api.sendMessage(chatId, message, { parse_mode: 'Markdown' });
          await this.reminderService.incrementReminderCount(chatId, date);

          console.log(`Sent follow-up reminder to chat ${chatId} for date ${date}, ${unrepliedUserIds.length} users pending`);
        } catch (error) {
          console.error(`Error sending follow-up reminder to chat ${chatId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error getting active chat IDs:', error);
    }
  }

  private getInitialReminderMessage(): string {
    return '🌅 Всем доброе утро! Пожалуйста, поделитесь своими планами на день.';
  }

  private escapeMarkdown(text: string): string {
    // Escape underscores in usernames for Markdown
    return text.replace(/_/g, '\\_');
  }

  private async getFollowUpReminderMessage(chatId: number, unrepliedUserIds: number[]): Promise<string> {
    const mentions: string[] = [];
    const activeUsers = await this.userService.getActiveUsersForChat(chatId);
    
    for (const userId of unrepliedUserIds) {
      const user = activeUsers.find((u: User) => u.telegramId === userId);
      if (user) {
        const escapedUsername = this.escapeMarkdown(user.username);
        mentions.push(`@${escapedUsername}`);
      } else {
        mentions.push(`[Пользователь ${userId}](tg://user?id=${userId})`);
      }
    }

    const mentionText = mentions.join(', ');
    return `⏰ Дружеское напоминание: ${mentionText}, пожалуйста, не забудьте поделиться своими планами на день!`;
  }

  // For testing/manual triggering
  public async getActiveChatIds(): Promise<number[]> {
    return this.userService.getActiveChatIds();
  }

  /**
   * Send PR reminders to all active chats
   */
  public async sendPrReminders(): Promise<void> {
    console.log('Sending PR reminders...');
    try {
      await this.prReminderService.sendPrReminders();
    } catch (error) {
      console.error('Error sending PR reminders:', error);
    }
  }

  /**
   * Get PR reminder service instance
   */
  public getPrReminderService(): PrReminderService {
    return this.prReminderService;
  }

  public async sendDutyReminders(): Promise<void> {
    try {
      await this.dutyReminderService.sendDutyReminders();
    } catch (error) {
      console.error('Error in scheduled duty reminders:', error);
    }
  }
} 