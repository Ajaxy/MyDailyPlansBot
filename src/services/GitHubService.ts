import { logger } from '../util/logger';

import type { RepositoryService } from './RepositoryService';

interface GitHubPr {
  number: number;
  title: string;
  html_url: string;
  base?: {
    repo?: {
      full_name: string;
    };
  };
  assignee?: {
    login: string;
  };
  assignees?: Array<{
    login: string;
  }>;
}

interface UserPrs {
  githubUsername: string;
  prs: Array<{
    number: number;
    title: string;
    url: string;
    repo: string;
  }>;
}

export class GitHubService {
  private repositoryService: RepositoryService;

  constructor(repositoryService: RepositoryService) {
    this.repositoryService = repositoryService;
  }

  /**
   * Get PRs assigned to specific GitHub usernames for a specific chat
   */
  public async getAssignedPrs(githubUsernames: string[], chatId: number): Promise<Map<string, UserPrs>> {
    const prsByUser = new Map<string, UserPrs>();

    // Initialize map with empty arrays for each user
    githubUsernames.forEach((username) => {
      prsByUser.set(username, {
        githubUsername: username,
        prs: [],
      });
    });

    // Create a lowercase mapping for case-insensitive matching
    const usernameLowerMap = new Map<string, string>();
    githubUsernames.forEach((username) => {
      usernameLowerMap.set(username.toLowerCase(), username);
    });

    try {
      const allPrs = await this.fetchOpenPrs(chatId);

      for (const pr of allPrs) {
        // Extract repo name from the PR's base repository
        // The repo info is in pr.base.repo.full_name (format: "owner/repo")
        const repoName = pr.base?.repo?.full_name || 'unknown';

        // Check assignees (GitHub PRs can have multiple assignees)
        const assignees = pr.assignees || (pr.assignee ? [pr.assignee] : []);

        for (const assignee of assignees) {
          // Case-insensitive username matching
          const originalUsername = usernameLowerMap.get(assignee.login.toLowerCase());
          if (originalUsername) {
            const userPrs = prsByUser.get(originalUsername)!;
            userPrs.prs.push({
              number: pr.number,
              title: pr.title,
              url: pr.html_url,
              repo: repoName,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error fetching assigned PRs:', error);
    }

    return prsByUser;
  }

  /**
   * Fetch all open PRs from repositories configured for a specific chat
   */
  private async fetchOpenPrs(chatId: number): Promise<GitHubPr[]> {
    const allPrs: GitHubPr[] = [];

    const repositories = await this.repositoryService.getActiveRepositoriesForChat(chatId);

    if (repositories.length === 0) {
      logger.info(`No repositories configured for chat ${chatId}`);
      return [];
    }

    for (const repo of repositories) {
      try {
        if (!repo.ghToken) {
          logger.info(`No GitHub token configured for repository ${repo.fullName}, skipping`);
          continue;
        }

        const headers = {
          Authorization: `Bearer ${repo.ghToken}`,
          Accept: 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        };

        const url = `https://api.github.com/repos/${repo.fullName}/pulls?state=open&per_page=100`;
        const response = await fetch(url, { headers });

        if (!response.ok) {
          logger.error(`Failed to fetch PRs from ${repo.fullName}: ${response.status} ${response.statusText}`);
          continue;
        }

        const prs = await response.json() as GitHubPr[];
        allPrs.push(...prs);
      } catch (error) {
        logger.error(`Error fetching PRs from ${repo.fullName}:`, error);
      }
    }

    return allPrs;
  }
}
