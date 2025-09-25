import { Client } from '@notionhq/client';
import type { Bot } from 'grammy';

import { env } from '../config/dotenv';
import { logger } from '../util/logger';
import type { User } from '../entities';

import type { UserService } from './UserService';

interface DutyAssignment {
  date: string;
  person: string;
}

const NOTION_PAGE_URL = 'https://www.notion.so/anywaylabs/2025-168ba64b3014802fb8cdf262d3fee85e';

export class DutyReminderService {
  private bot: Bot;
  private userService: UserService;
  private notion: Client;
  private readonly PAGE_ID = '168ba64b3014802fb8cdf262d3fee85e';
  private readonly DUTY_CHAT_ID = -1001783045675;

  constructor(bot: Bot, userService: UserService) {
    this.bot = bot;
    this.userService = userService;

    if (!env.notion.token) {
      logger.warn('NOTION_TOKEN is not configured. DutyReminderService will not function properly.');
    }

    this.notion = new Client({
      auth: env.notion.token || '',
    });
  }

  /**
   * Send duty reminders to the designated chat
   */
  public async sendDutyReminders(): Promise<void> {
    try {
      const todaysDuty = await this.getTodaysDuty();

      if (!todaysDuty) {
        logger.info('No duty assignment found for today');
        return;
      }

      logger.info(`Today's duty person: ${todaysDuty.person}`);

      // Only send to the specific duty chat
      await this.sendDutyReminderToChat(this.DUTY_CHAT_ID, todaysDuty);
    } catch (error) {
      logger.error('Error sending duty reminders:', error);
    }
  }

  /**
   * Send duty reminder to a specific chat
   */
  public async sendDutyReminderToChat(chatId: number, dutyAssignment?: DutyAssignment): Promise<void> {
    try {
      // If no duty assignment provided, fetch today's duty
      const duty = dutyAssignment || await this.getTodaysDuty();

      if (!duty) {
        logger.info(`No duty assignment found for today in chat ${chatId}`);
        return;
      }

      // Find user with matching Notion username in this chat
      const activeUsers = await this.userService.getActiveUsersForChat(chatId);
      const dutyUser = activeUsers.find((user: User) =>
        user.notionUsername && user.notionUsername.toLowerCase() === duty.person.toLowerCase(),
      );

      if (!dutyUser) {
        logger.info(`No user found with Notion username "${duty.person}" in chat ${chatId}`);
      }

      // Build and send reminder message (handles both found and not found cases)
      const message = this.buildDutyReminderMessage(duty.person, dutyUser);

      await this.bot.api.sendMessage(chatId, message, {
        parse_mode: 'HTML',
      });

      logger.info(
        `Sent duty reminder to chat ${chatId} for ${
          dutyUser ? `user @${dutyUser.username}` : `Notion user "${duty.person}"`
        }`,
      );
    } catch (error) {
      logger.error(`Error sending duty reminder to chat ${chatId}:`, error);
    }
  }

  /**
   * Fetch today's duty assignment from Notion
   */
  private async getTodaysDuty(): Promise<DutyAssignment | undefined> {
    try {
      if (!env.notion.token) {
        logger.error('NOTION_TOKEN is not configured');
        return undefined;
      }

      // Get all blocks from the page
      const blocks = await this.getPageBlocks(this.PAGE_ID);

      // Find table blocks
      const tableBlocks = blocks.filter((block: any) => block.type === 'table');

      if (tableBlocks.length === 0) {
        logger.info('No table found on the Notion page');
        return undefined;
      }

      // Process each table to find today's duty
      for (const table of tableBlocks) {
        logger.info(`Processing table block: ${table.id}`);
        const dutyAssignment = await this.parseTableForDuty(table.id);
        if (dutyAssignment) {
          return dutyAssignment;
        }
      }

      return undefined;
    } catch (error) {
      logger.error('Error fetching duty from Notion:', error);
      return undefined;
    }
  }

  /**
   * Get all blocks from a Notion page
   */
  private async getPageBlocks(pageId: string): Promise<any[]> {
    const blocks: any[] = [];
    let cursor: string | undefined = undefined;

    do {
      const response = await this.notion.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
      });

      blocks.push(...response.results);
      cursor = response.next_cursor || undefined;
    } while (cursor);

    return blocks;
  }

  /**
   * Parse a table block to find today's duty assignment
   */
  private async parseTableForDuty(tableId: string): Promise<DutyAssignment | undefined> {
    try {
      // Get table rows
      const rows = await this.getPageBlocks(tableId);

      // Filter for table_row blocks
      const tableRows = rows.filter((block: any) => block.type === 'table_row');

      if (tableRows.length === 0) {
        return undefined;
      }

      const todayDate = this.getTodayDate();
      logger.info(`Looking for duty assignment for date: ${todayDate}`);

      // Check each row for today's date
      for (let i = 0; i < tableRows.length; i++) {
        const row = tableRows[i];
        const cells = row.table_row?.cells || [];

        // Table structure: Date | Weekday | Username(s)
        if (cells.length >= 3) {
          const dateText = this.extractTextFromCell(cells[0]);
          const usernameCell = cells[2];

          // Skip header rows
          if (i === 0 && dateText.toLowerCase().includes('date')) {
            logger.info('Skipping header row');
            continue;
          }

          // Check if first column matches today's date
          if (this.isDateMatch(dateText, todayDate)) {
            // Extract the active username from the cell (handling strikethrough)
            const activeUsername = await this.extractActiveUsername(usernameCell);

            if (activeUsername) {
              logger.info(`Found duty assignment for ${todayDate}: ${activeUsername}`);
              return {
                date: todayDate,
                person: activeUsername,
              };
            }
          }
        }
      }

      return undefined;
    } catch (error) {
      logger.error('Error parsing table:', error);
      return undefined;
    }
  }

  /**
   * Extract text content from a table cell
   */
  private extractTextFromCell(cell: any[]): string {
    if (!cell || cell.length === 0) return '';

    return cell
      .map((richText: any) => richText.plain_text || '')
      .join('')
      .trim();
  }

  /**
   * Extract the active username from a cell, handling strikethrough text
   * When duty changes, the old user is strikethrough and new user is added
   */
  private async extractActiveUsername(cell: any[]): Promise<string> {
    if (!cell || cell.length === 0) return '';

    // Collect all usernames that are NOT strikethrough
    const activeUsernames: string[] = [];

    for (const richText of cell) {
      const isStrikethrough = richText.annotations?.strikethrough || false;

      // Skip strikethrough text
      if (isStrikethrough) continue;

      // Check if this is a user mention
      if (richText.type === 'mention' && richText.mention?.type === 'user') {
        const userId = richText.mention.user.id;

        try {
          // Fetch user details from Notion API
          const userDetails = await this.notion.users.retrieve({ user_id: userId });

          if (userDetails.name) {
            logger.info(`Found user: ${userDetails.name}`);
            activeUsernames.push(userDetails.name);
          }
        } catch (error) {
          logger.error('Error fetching user details:', error);
        }
      }
    }

    logger.info(`Found ${activeUsernames.length} active username(s) in cell:`, activeUsernames);

    // If multiple active usernames, take the last one (most recent)
    if (activeUsernames.length > 0) {
      return activeUsernames[activeUsernames.length - 1];
    }

    return '';
  }

  /**
   * Check if a date string matches today's date
   * Expected format: DD.MM.YYYY (e.g., "16.04.2025")
   */
  private isDateMatch(dateStr: string, targetDate: string): boolean {
    return dateStr.trim() === targetDate;
  }

  /**
   * Build duty reminder message
   */
  private buildDutyReminderMessage(notionName: string, user?: User): string {
    const escapedNotionName = this.escapeHtml(notionName);

    if (!user) {
      // No user found with this Notion username
      return `🔔 <b>Сегодня дежурит: ${escapedNotionName}</b>\n\n`
        + `⚠️ Пользователь с Notion username "${escapedNotionName}" не найден в этом чате.\n\n`
        + `📋 <a href="${NOTION_PAGE_URL}">Задачи дежурного</a>`;
    }

    const escapedUsername = this.escapeHtml(user.username);
    return `🔔 <b>Напоминание о дежурстве</b>\n\n`
      + `👤 Сегодня дежурит: <b>@${escapedUsername}</b> (${escapedNotionName})\n\n`
      + `📋 Пожалуйста, не забудьте выполнить все <a href="${NOTION_PAGE_URL}">задачи дежурного</a>!`;
  }

  /**
   * Get today's date in DD.MM.YYYY format
   */
  private getTodayDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${day}.${month}.${year}`;
  }

  /**
   * Escape HTML characters to prevent injection
   */
  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&#39;',
    };
    return text.replace(/[&<>"']/g, (match) => htmlEntities[match]);
  }
}
