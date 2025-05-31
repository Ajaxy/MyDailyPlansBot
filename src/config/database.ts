import { DataSource } from 'typeorm';
import * as path from 'path';
import { env } from './dotenv';

// Import pg to define custom type parser for bigint
import { types } from 'pg';

// Configure PostgreSQL to return bigint as JavaScript BigInt
types.setTypeParser(types.builtins.INT8, (val: string | null) => (val === null ? null : BigInt(val)));

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.database.host,
  port: env.database.port,
  username: env.database.username,
  password: env.database.password,
  database: env.database.database,
  synchronize: true, // Set to false in production
  logging: false,
  entities: [],
  migrations: [path.join(__dirname, '../migrations/**/*.ts')],
  subscribers: [],
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
