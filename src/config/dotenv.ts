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
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'TRACKED_USER_IDS',
  'ACTIVE_CHAT_IDS',
];

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
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    trackedUserIds: process.env.TRACKED_USER_IDS
      ? process.env.TRACKED_USER_IDS.split(',').map(id => parseInt(id.trim(), 10))
      : [],
    activeChatIds: process.env.ACTIVE_CHAT_IDS
      ? process.env.ACTIVE_CHAT_IDS.split(',').map(id => parseInt(id.trim(), 10))
      : [],
  },
};

export default env;
