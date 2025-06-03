import * as cron from 'node-cron';
import { Bot } from 'grammy';
import { StateManager } from './stateManager';
import { UserService } from './UserService';
import { REMINDER_SCHEDULE, WORKING_DAYS } from '../types';
import { User } from '../entities';

export class SchedulerService {
  private stateManager: StateManager;
  private bot: Bot;
  private userService: UserService;

  constructor(bot: Bot, stateManager: StateManager, userService: UserService) {
    this.bot = bot;
    this.stateManager = stateManager;
    this.userService = userService;
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

    console.log('Daily plan reminder scheduler started');
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
          const state = this.stateManager.getState(chatId, date);

          // Reset state for new day if it's the first reminder
          if (state.reminderCount === 0) {
            this.stateManager.resetStateForDate(chatId, date);
          }

          const message = this.getInitialReminderMessage();
          await this.bot.api.sendMessage(chatId, message);
          this.stateManager.incrementReminderCount(chatId, date);

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
          const state = this.stateManager.getState(chatId, date);

          // Only send follow-up if we haven't exceeded the limit (4 total reminders)
          if (state.reminderCount >= 4) {
            continue;
          }

          const trackedUserIds = await this.userService.getTrackedUserIdsForChat(chatId);
          const unrepliedUserIds = this.stateManager.getUnrepliedUserIds(chatId, date, trackedUserIds);

          // Skip if everyone has replied
          if (unrepliedUserIds.length === 0) {
            continue;
          }

          const message = await this.getFollowUpReminderMessage(chatId, unrepliedUserIds);
          await this.bot.api.sendMessage(chatId, message, { parse_mode: 'Markdown' });
          this.stateManager.incrementReminderCount(chatId, date);

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

  private async getFollowUpReminderMessage(chatId: number, unrepliedUserIds: number[]): Promise<string> {
    const mentions: string[] = [];
    const activeUsers = await this.userService.getActiveUsersForChat(chatId);
    
    for (const userId of unrepliedUserIds) {
      const user = activeUsers.find((u: User) => u.telegramId === userId);
      if (user) {
        mentions.push(`@${user.username}`);
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
}
