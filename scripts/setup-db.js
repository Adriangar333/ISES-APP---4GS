const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up database...');

try {
  // Check if PostgreSQL is running
  execSync('pg_isready', { stdio: 'ignore' });
  console.log('✅ PostgreSQL is running');
} catch (error) {
  console.error('❌ PostgreSQL is not running. Please start PostgreSQL first.');
  process.exit(1);
}

try {
  // Create database if it doesn't exist
  console.log('📦 Creating database...');
  try {
    execSync('createdb route_assignment_db', { stdio: 'ignore' });
    console.log('✅ Database created');
  } catch (error) {
    console.log('ℹ️ Database already exists or creation failed');
  }

  // Run initialization script
  console.log('🔧 Running database initialization...');
  const initSqlPath = path.join(__dirname, '..', 'database', 'init.sql');
  execSync(`psql route_assignment_db -f "${initSqlPath}"`, { stdio: 'inherit' });
  console.log('✅ Database initialized');

  // Run seed script
  console.log('🌱 Seeding database...');
  const seedSqlPath = path.join(__dirname, '..', 'database', 'seed.sql');
  execSync(`psql route_assignment_db -f "${seedSqlPath}"`, { stdio: 'inherit' });
  console.log('✅ Database seeded');

  console.log('🎉 Database setup completed successfully!');
} catch (error) {
  console.error('❌ Database setup failed:', error.message);
  process.exit(1);
}