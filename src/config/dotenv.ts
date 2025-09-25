import * as dotenv from 'dotenv';
import * as path from 'path';

// Configure dotenv to properly load .env file from root directory
const result = dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

if (result.error) {
  console.warn('Warning: .env file not found or cannot be read.');
}

function parseDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432', 10),
      username: parsed.username,
      password: parsed.password,
      database: parsed.pathname.slice(1),
    };
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL format: ${error}`);
  }
}

let databaseConfig;

if (process.env.DATABASE_URL) {
  databaseConfig = parseDatabaseUrl(process.env.DATABASE_URL);
} else {
  const requiredDbEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'];
  const missingDbEnvVars = requiredDbEnvVars.filter(envVar => !process.env[envVar]);

  if (missingDbEnvVars.length) {
    console.error(`Error: Missing database environment variables: ${missingDbEnvVars.join(', ')}`);
    console.error('Provide either DATABASE_URL or all individual DB_ variables');
  }

  databaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'mdp',
  };
}

const requiredEnvVars = ['TELEGRAM_BOT_TOKEN'];
const missingRequiredEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingRequiredEnvVars.length) {
  console.error(`Error: Missing environment variables: ${missingRequiredEnvVars.join(', ')}`);
}

export const env = {
  worker: {
    interval: parseInt(process.env.WORKER_INTERVAL || '5000', 10),
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },
  database: databaseConfig,
  notion: {
    token: process.env.NOTION_TOKEN || '',
  },
};

export default env;
