import * as dotenv from 'dotenv';
import * as path from 'path';

// Configure dotenv to properly load .env file from root directory
const result = dotenv.config({
  path: path.resolve(process.cwd(), '.env')
});

if (result.error) {
  console.warn('Warning: .env file not found or cannot be read.');
}

// Validate required environment variables
const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
];

const missingRequiredEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingRequiredEnvVars.length) {
  console.error(`Error: Missing environment variables: ${missingRequiredEnvVars.join(', ')}`);
}

// Export for direct access
export const env = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'lao',
  },
  api: {
    port: parseInt(process.env.API_PORT || '3000', 10),
  },
  worker: {
    interval: parseInt(process.env.WORKER_INTERVAL || '5000', 10),
  },
  telegram: {
    apiId: Number(process.env.TELEGRAM_API_ID),
    apiHash: process.env.TELEGRAM_API_HASH,
    phoneNumber: process.env.TELEGRAM_PHONE_NUMBER,
    // botToken: process.env.TELEGRAM_BOT_TOKEN,
  },
};

export default env;
