import 'reflect-metadata'; // Required for TypeORM
import { PROJECT_NAME } from '../config';
import { env } from '../config/dotenv';
import { initializeDatabase } from '../config/database';
import { BotService } from '../services';

(async () => {
  try {
    // Initialize database connection first
    await initializeDatabase();
    console.log('Database initialized successfully');

    // Initialize the bot
    const botService = new BotService({
      token: env.telegram.botToken,
    });

    // In development mode, listen for manual reminder triggers
    if (process.env.NODE_ENV !== 'production') {
      console.log('Development mode: Type "remind" or "remind 6" to manually trigger reminders, "remind_pr" for PR reminders, or "quit" to exit');

      process.stdin.setEncoding('utf8');
      process.stdin.on('readable', () => {
        const chunk = process.stdin.read();
        if (chunk !== null) {
          const input = chunk.toString().trim().toLowerCase();

          if (input === 'remind' || input.startsWith('remind ')) {
            const parts = input.split(' ');
            const hour = parts.length > 1 ? parseInt(parts[1], 10) : undefined;

            if (parts.length > 1 && isNaN(hour!)) {
              console.log('Invalid hour. Use "remind" or "remind 6" for initial reminder.');
              return;
            }

            console.log(`Triggering manual reminder${hour !== undefined ? ` (hour: ${hour})` : ''}...`);
            botService.triggerReminder(hour).catch(error => {
              console.error('Error triggering reminder:', error);
            });
          } else if (input === 'remind_pr') {
            console.log('Triggering manual PR reminders...');
            botService.triggerPrReminder().catch(error => {
              console.error('Error triggering PR reminder:', error);
            });
          } else if (input === 'quit' || input === 'exit') {
            console.log('Exiting...');
            process.exit(0);
          } else if (input) {
            console.log('Commands: "remind" (follow-up), "remind 6" (initial), "remind_pr" (PR reminders), "quit" to exit.');
          }
        }
      });
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log(`${PROJECT_NAME} Worker service shutting down...`);
      void botService.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log(`${PROJECT_NAME} Worker service received SIGTERM, shutting down...`);
      void botService.stop();
      process.exit(0);
    });

    // Start the bot (this should be last as it blocks execution)
    await botService.start();

    console.log(`${PROJECT_NAME} Worker service started successfully`);
  } catch (error) {
    console.error(`Error starting ${PROJECT_NAME} Worker service:`, error);
    process.exit(1);
  }
})();
