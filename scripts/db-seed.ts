import { AppDataSource } from '../src/config/database';
import '../src/config/dotenv'; // Import to ensure environment variables are loaded

export async function seedDatabase(withStubs = false): Promise<void> {
  console.log(withStubs
    ? 'Seeding database with schema, initial and stub data...'
    : 'Creating database schema and initial data...'
  );

  try {
    await AppDataSource.initialize();

    // Initialize the database schema by synchronizing the entities
    console.log('Creating database schema...');
    await AppDataSource.synchronize();
    console.log('Database schema created successfully!');

    // TODO

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await AppDataSource.destroy();
  }
}

// Run the seed function if this file is executed directly
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const withStubs = args.includes('--with-stubs');

  seedDatabase(withStubs)
    .then(() => {
      console.log('Process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Process failed:', error);
      process.exit(1);
    });
}
