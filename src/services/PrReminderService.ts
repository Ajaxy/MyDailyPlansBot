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
   * Build PR reminder message with a checklist at the end
   */
  private buildPrReminderMessage(
    users: User[],
    prsByUser: Map<string, {
      githubUsername: string;
      prs: Array<{ number: number; title: string; url: string; repo: string; hideRepoName: boolean }>;
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
          const repoSuffix = pr.hideRepoName ? '' : ` (${pr.repo})`;
          userMessage += `\n• ${prLink} - ${escapedTitle}${repoSuffix}`;
        }

        userMessages.push(userMessage);
      }
    }

    if (userMessages.length === 0) {
      return undefined;
    }

    // Header in Russian as requested
    const header = '🔔 <b>Пожалуйста, выполните действие в PR, назначенных вам:</b>';

    // Checklist as a quote
    /* eslint-disable @stylistic/max-len */
    const checklist = `<blockquote><b>Чеклист</b>

1. Во <a href="https://github.com/pulls?q=user:mytonwalletorg+user:mytonwallet-org+assignee:@me+is:pr+is:open+archived:false">всех PR, где вы assignee</a>, сделайте ожидаемое от вас действие и снимите с себя assignee. Если не можете сделать действие, напишите в PR, почему.
2. Доведение PR до слития — задача его автора. Если <a href="https://github.com/pulls?q=user:mytonwalletorg+user:mytonwallet-org+author:@me+is:pr+is:open+archived:false+draft:false">один из ваших PR</a> застрял, отправьте напоминание тому, на кого он назначен, в личных сообщениях.

• Если вы <b>получили замечания</b>, исправьте их и назначьте людей на ревью в поле Assignee.
• Если вы <b>ожидаете действие</b> от другого человека, напомните ему в личку и убедитесь, что он в Assignee.
• Если <b>всё готово</b>, слейте PR.
• Если на данный момент ничего с PR <b>сделать нельзя или вы заняты</b> неотложной задачей, напишите в PR, почему.
• Если по какой-то причине вы <b>приостановили работу</b> над PR на длительный срок, добавьте <code>[Paused]</code> в заголовок, чтобы исключить его из уведомлений.
</blockquote>`;
    /* eslint-enable @stylistic/max-len */

    return [header, ...userMessages, checklist].join('');
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
