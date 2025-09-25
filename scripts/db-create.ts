import { spawn } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { Client } from 'pg';

import { env } from '../src/config/dotenv';

// Load environment variables from .env file if it exists
const result = dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

if (result.error) {
  console.warn('Warning: .env file not found or cannot be read. Using environment variables.');
}

// Use the existing database configuration from dotenv
const { host: DB_HOST, port: DB_PORT, username: DB_USERNAME, password: DB_PASSWORD, database: DB_DATABASE } = env.database;

// Parse command line arguments
const args = process.argv.slice(2);
const force = args.includes('--force');
const withStubs = args.includes('--with-stubs');

console.log(`=== Database Setup Script ===`);
console.log(`Target database: "${DB_DATABASE}" on ${DB_HOST}:${DB_PORT}`);
console.log(`Options: ${force ? 'Force mode enabled' : 'Force mode disabled'}, ${withStubs ? 'Full stub seed enabled' : 'Essential seed only mode enabled'}`);

(async function runSetup() {
  await setupDatabase();
})();

async function setupDatabase(): Promise<void> {
  try {
    // Connect to the default 'postgres' database first
    const client = new Client({
      host: DB_HOST,
      port: parseInt(DB_PORT.toString(), 10),
      user: DB_USERNAME,
      password: DB_PASSWORD,
      database: 'postgres', // Connect to default database
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false, // Enable SSL for Heroku
    });

    await client.connect();
    console.log('Connected to PostgreSQL server');

    // Track if the database is new or was recreated
    let databaseIsNew = false;

    if (force) {
      // Terminate all connections to our target database
      try {
        await client.query(`
          SELECT pg_terminate_backend(pg_stat_activity.pid)
          FROM pg_stat_activity
          WHERE pg_stat_activity.datname = $1
          AND pid <> pg_backend_pid();
        `, [DB_DATABASE]);
        console.log('Terminated all connections to the database');
      } catch (err) {
        console.error('Error terminating connections:', err);
        // Continue anyway
      }

      // Drop database if exists in force mode
      try {
        await client.query(`DROP DATABASE IF EXISTS "${DB_DATABASE}"`);
        console.log(`Database "${DB_DATABASE}" dropped.`);
      } catch (err) {
        console.error('Error dropping database:', err);
        // Continue anyway
      }

      // Create the database
      const dbName = DB_DATABASE.replace(/'/g, '\'\''); // Escape single quotes
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${DB_DATABASE}" created successfully.`);

      // Set flag to indicate database is new/recreated
      databaseIsNew = true;
    } else {
      // Check if database exists
      const checkResult = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [DB_DATABASE],
      );

      if (checkResult.rows.length === 0) {
        // Database doesn't exist, create it
        const dbName = DB_DATABASE.replace(/'/g, '\'\''); // Escape single quotes
        await client.query(`CREATE DATABASE "${dbName}"`);
        console.log(`Database "${DB_DATABASE}" created successfully.`);

        // Set flag to indicate database is new
        databaseIsNew = true;
      } else {
        console.log(`Database "${DB_DATABASE}" already exists.`);
      }
    }

    await client.end();

    if (databaseIsNew) {
      if (withStubs) {
        runSeedScript(['--with-stubs']);
      } else {
        runSeedScript([]);
      }
    } else {
      console.log('Database already existed, skipping seed script');
      console.log('=== Database setup completed! ===');
    }
  } catch (err) {
    console.error('Error setting up database:', err);
    console.log('\nManual steps to setup the database:');
    console.log('1. Open your PostgreSQL admin tool (e.g., pgAdmin, psql, etc.)');
    if (force) {
      console.log(`2. Drop the existing database named "${DB_DATABASE}" if it exists`);
      console.log(`3. Create a new database named "${DB_DATABASE}"`);
    } else {
      console.log(`2. Create a new database named "${DB_DATABASE}" if it doesn't exist`);
    }
    console.log('3. Run the seed script: npm run seed\n');
    process.exit(1);
  }
}

// Run the seeding script with optional arguments
function runSeedScript(args: string[] = []): void {
  console.log('Running database seed script...');

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const seedArgs = ['run', 'db:seed', '--', ...args];

  console.log(`Executing: npm ${seedArgs.join(' ')}`);
  const seed = spawn(npm, seedArgs, { stdio: 'inherit' });

  seed.on('error', (err: Error) => {
    console.error('Failed to start seed script:', err);
    process.exit(1);
  });

  seed.on('close', (code: number) => {
    if (code === 0) {
      console.log('=== Database setup and schema creation completed successfully! ===');
      process.exit(0);
    } else {
      console.error(`Error running seed script. Exit code: ${code}`);
      process.exit(1);
    }
  });
}
