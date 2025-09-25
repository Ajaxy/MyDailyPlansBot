import * as path from 'path';
// Import pg to define custom type parser for bigint
import { types } from 'pg';
import { DataSource } from 'typeorm';

import { Off, Plan, ReminderState, Repository, User } from '../entities';
import { env } from './dotenv';

// Configure PostgreSQL to return bigint as JavaScript numbers
types.setTypeParser(types.builtins.INT8, (val: string | null) => (val === null ? null : parseInt(val, 10)));

const sslConfig = process.env.DATABASE_URL ? {
  ssl: {
    rejectUnauthorized: false,
  },
} : {};

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.database.host,
  port: env.database.port,
  username: env.database.username,
  password: env.database.password,
  database: env.database.database,
  synchronize: true, // Set to false in production
  logging: false,
  entities: [
    User,
    Plan,
    ReminderState,
    Repository,
    Off,
  ],
  migrations: [path.join(__dirname, '../migrations/**/*.ts')],
  subscribers: [],
  ...sslConfig,
});

// Initialize database connection
export const initializeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Error initializing database connection:', error);
    throw error;
  }
};
