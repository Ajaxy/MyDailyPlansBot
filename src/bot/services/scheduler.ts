import * as cron from 'node-cron';
import { Bot } from 'grammy';
import { StateManager } from './stateManager';
import { REMINDER_SCHEDULE, WORKING_DAYS } from '../types';

export class SchedulerService {
  private stateManager: StateManager;
  private bot: Bot;
  private trackedUserIds: number[];
  private activeChats: Set<number> = new Set();

  constructor(bot: Bot, stateManager: StateManager, trackedUserIds: number[]) {
    this.bot = bot;
    this.stateManager = stateManager;
    this.trackedUserIds = trackedUserIds;
  }

  public addChat(chatId: number): void {
    this.activeChats.add(chatId);
  }

  public removeChat(chatId: number): void {
    this.activeChats.delete(chatId);
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

    for (const chatId of this.activeChats) {
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
  }

  public async sendFollowUpReminder(): Promise<void> {
    const date = this.getCurrentDate();

    for (const chatId of this.activeChats) {
      try {
        const state = this.stateManager.getState(chatId, date);

        // Only send follow-up if we haven't exceeded the limit (4 total reminders)
        if (state.reminderCount >= 4) {
          continue;
        }

        const unrepliedUsers = this.stateManager.getUnrepliedUsers(chatId, date, this.trackedUserIds);

        // Skip if everyone has replied
        if (unrepliedUsers.length === 0) {
          continue;
        }

        const message = await this.getFollowUpReminderMessage(chatId, unrepliedUsers);
        await this.bot.api.sendMessage(chatId, message);
        this.stateManager.incrementReminderCount(chatId, date);

        console.log(`Sent follow-up reminder to chat ${chatId} for date ${date}, ${unrepliedUsers.length} users pending`);
      } catch (error) {
        console.error(`Error sending follow-up reminder to chat ${chatId}:`, error);
      }
    }
  }

  private getInitialReminderMessage(): string {
    return '🌅 Всем доброе утро! Пожалуйста, поделитесь своими планами на день.';
  }

  private async getFollowUpReminderMessage(chatId: number, unrepliedUserIds: number[]): Promise<string> {
    const mentions: string[] = [];

    for (const userId of unrepliedUserIds) {
      try {
        const chatMember = await this.bot.api.getChatMember(chatId, userId);
        const user = chatMember.user;

        if (user.username) {
          mentions.push(`@${user.username}`);
        } else {
          const name = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
          mentions.push(`[${name}](tg://user?id=${userId})`);
        }
      } catch (error) {
        console.warn(`Could not get user info for ${userId}:`, error);
        mentions.push(`[Пользователь ${userId}](tg://user?id=${userId})`);
      }
    }

    const mentionText = mentions.join(', ');
    return `⏰ Дружеское напоминание: ${mentionText}, пожалуйста, не забудьте поделиться своими планами на день!`;
  }

  public getActiveChats(): Set<number> {
    return new Set(this.activeChats);
  }
}
