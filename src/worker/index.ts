import { PROJECT_NAME } from '../config';
import { env } from '../config/dotenv';
import { BotService } from '../bot';

(async () => {
  try {
    // Initialize the bot
    const botService = new BotService({
      token: env.telegram.botToken,
      trackedUserIds: env.telegram.trackedUserIds,
    });

    // Start the bot
    await botService.start();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log(`${PROJECT_NAME} Worker service shutting down...`);
      await botService.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log(`${PROJECT_NAME} Worker service received SIGTERM, shutting down...`);
      await botService.stop();
      process.exit(0);
    });

    console.log(`${PROJECT_NAME} Worker service started successfully`);
  } catch (error) {
    console.error(`Error starting ${PROJECT_NAME} Worker service:`, error);
    process.exit(1);
  }
})();
