import { AppDataSource } from '../src/config/database';
import { User } from '../src/entities';

import '../src/config/dotenv'; // Import to ensure environment variables are loaded

export async function seedDatabase(withStubs = false): Promise<void> {
  console.log(withStubs
    ? 'Seeding database with schema and real user data...'
    : 'Creating database schema only...',
  );

  try {
    await AppDataSource.initialize();

    // Initialize the database schema by synchronizing the entities
    console.log('Creating database schema...');
    await AppDataSource.synchronize();
    console.log('Database schema created successfully!');

    if (withStubs) {
      console.log('Creating real user data...');

      const userRepository = AppDataSource.getRepository(User);

      const realUsers = [
        new User(1761163019, -1001879711349, 'unexpectedusername', true),
        new User(3718260, -1001879711349, 'zinchuk', true),

        new User(656567, -1001783045675, 'worldsbeer', true),
        new User(1002543, -1001783045675, 'artemrepka', true),
        new User(48656726, -1001783045675, 'SinaKhalili', true),
        new User(52515494, -1001783045675, 'moving_away', true),
        new User(406814914, -1001783045675, 'artemii', true),
        new User(427775494, -1001783045675, 'surgie', true),
        new User(1220362133, -1001783045675, 'troman29', true),
        new User(1368727604, -1001783045675, 'difhel', true),
        new User(7593042429, -1001783045675, 'eeraarons', true),

        new User(202466030, -1001834943589, 'zubiden', true),
        new User(265821897, -1001834943589, 'Domokol', true),
        new User(365759348, -1001834943589, 'Maxdestor', true),
        new User(620636822, -1001834943589, 'amdmt', true),
      ];

      for (const user of realUsers) {
        await userRepository.save(user);
        console.log(`Created user: @${user.username} (ID: ${user.telegramId}) in chat ${user.chatId}`);
      }

      console.log(`Created ${realUsers.length} real users across 3 chats`);
    }

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
