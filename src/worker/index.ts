import { initializeDatabase } from '../config/database';
import { PROJECT_NAME } from '../config';

(async () => {
  try {
    await initializeDatabase();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(`${PROJECT_NAME} Worker service shutting down...`);
      process.exit(0);
    });

    console.log(`${PROJECT_NAME} Worker service started successfully`);
  } catch (error) {
    console.error(`Error starting ${PROJECT_NAME} Worker service:`, error);

    process.exit(1);
  }
})();
