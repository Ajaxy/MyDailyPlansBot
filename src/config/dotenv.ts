import * as dotenv from 'dotenv';
import * as path from 'path';

// Configure dotenv to properly load .env file from root directory
const result = dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

if (result.error) {
  console.warn('Warning: .env file not found or cannot be read.');
}

// Validate required environment variables
const requiredEnvVars: string[] = [];

const missingRequiredEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingRequiredEnvVars.length) {
  console.error(`Error: Missing environment variables: ${missingRequiredEnvVars.join(', ')}`);
}

// Export for direct access
export const env = {
  worker: {
    interval: parseInt(process.env.WORKER_INTERVAL || '5000', 10),
  },
  telegram: {
    // botToken: process.env.TELEGRAM_BOT_TOKEN,
  },
};

export default env;
