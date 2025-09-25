import { PROJECT_NAME } from '../config';
import { initializeDatabase } from '../config/database';
import { env } from '../config/dotenv';
import { logger } from '../util/logger';
import { BotService } from '../services';

import 'reflect-metadata'; // Required for TypeORM

void (async () => {
  try {
    // Initialize database connection first
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Initialize the bot
    const botService = new BotService({
      token: env.telegram.botToken,
    });

    // In development mode, listen for manual reminder triggers
    if (process.env.NODE_ENV !== 'production') {
      logger.info(
        'Development mode: Type "remind" or "remind 6" to manually trigger reminders, '
        + '"remind_pr" for PR reminders, "remind_duty" for duty reminders, or "quit" to exit');

      process.stdin.setEncoding('utf8');
      process.stdin.on('readable', () => {
        const chunk = process.stdin.read() as string | null;
        // eslint-disable-next-line no-null/no-null
        if (chunk !== null) {
          const input = chunk.toString().trim().toLowerCase();

          if (input === 'remind' || input.startsWith('remind ')) {
            const parts = input.split(' ');
            const hour = parts.length > 1 ? parseInt(parts[1], 10) : undefined;

            if (parts.length > 1 && isNaN(hour!)) {
              logger.info('Invalid hour. Use "remind" or "remind 6" for initial reminder.');
              return;
            }

            logger.info(`Triggering manual reminder${hour !== undefined ? ` (hour: ${hour})` : ''}...`);
            botService.triggerReminder(hour).catch((error) => {
              logger.error('Error triggering reminder:', error);
            });
          } else if (input === 'remind_pr') {
            logger.info('Triggering manual PR reminders...');
            botService.triggerPrReminder().catch((error) => {
              logger.error('Error triggering PR reminder:', error);
            });
          } else if (input === 'remind_duty') {
            logger.info('Triggering manual duty reminders...');
            botService.triggerDutyReminder().catch((error) => {
              logger.error('Error triggering duty reminder:', error);
            });
          } else if (input === 'quit' || input === 'exit') {
            logger.info('Exiting...');
            process.exit(0);
          } else if (input) {
            logger.info(
              'Commands: "remind" (follow-up), "remind 6" (initial), "remind_pr" (PR reminders), '
              + '"remind_duty" (duty reminders), "quit" to exit.');
          }
        }
      });
    }

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info(`${PROJECT_NAME} Worker service shutting down...`);
      void botService.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info(`${PROJECT_NAME} Worker service received SIGTERM, shutting down...`);
      void botService.stop();
      process.exit(0);
    });

    // Start the bot (this should be last as it blocks execution)
    await botService.start();

    logger.info(`${PROJECT_NAME} Worker service started successfully`);
  } catch (error) {
    logger.error(`Error starting ${PROJECT_NAME} Worker service:`, error);
    process.exit(1);
  }
})();
