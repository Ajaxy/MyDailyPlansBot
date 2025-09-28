import type { Bot } from 'grammy';

import { logger } from '../util/logger';
import type { User } from '../entities';

import type { GitHubService } from './GitHubService';
import type { UserService } from './UserService';

export class PrReminderService {
  private bot: Bot;
  private githubService: GitHubService;
  private userService: UserService;

  constructor(bot: Bot, githubService: GitHubService, userService: UserService) {
    this.bot = bot;
    this.githubService = githubService;
    this.userService = userService;
  }

  /**
   * Send PR reminders to all active chats
   * Only sends reminders to chats that have:
   * 1. Users with GitHub usernames configured (including inactive users)
   * 2. Repositories with GitHub tokens configured for that chat
   * 3. Open PRs assigned to those users
   */
  public async sendPrReminders(): Promise<void> {
    try {
      const activeChatIds = await this.userService.getActiveChatIds();

      for (const chatId of activeChatIds) {
        await this.sendPrReminderToChat(chatId);
      }
    } catch (error) {
      logger.error('Error sending PR reminders:', error);
    }
  }

  /**
   * Send PR reminder to a specific chat
   */
  public async sendPrReminderToChat(chatId: number): Promise<void> {
    try {
      // Get all users with GitHub usernames in this chat (including inactive users)
      const allUsers = await this.userService.getAllUsersForChat(chatId);
      const usersWithGitHub = allUsers.filter((user: User) => user.githubUsername);

      if (usersWithGitHub.length === 0) {
        logger.info(`No users with GitHub usernames in chat ${chatId}, skipping PR reminder`);
        return;
      }

      // Get GitHub usernames
      const githubUsernames = usersWithGitHub.map((user: User) => user.githubUsername!);

      // Fetch assigned PRs for this chat
      const prsByUser = await this.githubService.getAssignedPrs(githubUsernames, chatId);

      // Build reminder message
      const message = this.buildPrReminderMessage(usersWithGitHub, prsByUser);

      if (message) {
        await this.bot.api.sendMessage(chatId, message, {
          parse_mode: 'HTML',
        });
        logger.info(`Sent PR reminder to chat ${chatId}`);
      } else {
        logger.info(`No PRs to remind about in chat ${chatId}`);
      }
    } catch (error) {
      logger.error(`Error sending PR reminder to chat ${chatId}:`, error);
    }
  }

  /**
   * Build PR reminder message
   */
  private buildPrReminderMessage(
    users: User[],
    prsByUser: Map<string, {
      githubUsername: string;
      prs: Array<{ number: number; title: string; url: string; repo: string }>;
    }>,
  ): string | undefined {
    const userMessages: string[] = [];

    for (const user of users) {
      const userPrs = prsByUser.get(user.githubUsername!);
      if (userPrs && userPrs.prs.length > 0) {
        // Escape HTML characters in username
        const escapedUsername = this.escapeHtml(user.username);
        let userMessage = `\n\n👤 <b>@${escapedUsername}</b>`;

        for (const pr of userPrs.prs) {
          // Escape HTML characters in PR title
          const escapedTitle = this.escapeHtml(pr.title);
          const prLink = `<a href="${pr.url}">#${pr.number}</a>`;
          userMessage += `\n• ${prLink} - ${escapedTitle} (${pr.repo})`;
        }

        userMessages.push(userMessage);
      }
    }

    if (userMessages.length === 0) {
      return undefined;
    }

    // Header in Russian as requested
    const header = '🔔 <b>Пожалуйста, проверьте следующие PR, назначенные вам:</b>';
    return header + userMessages.join('');
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
