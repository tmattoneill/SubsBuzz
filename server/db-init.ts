import { execSync } from 'child_process';
import { db } from './db';
import { sql } from 'drizzle-orm';

export async function initializeDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('🔍 Checking database connection...');
  
  try {
    // Test database connection
    await db.execute(sql`SELECT 1`);
    console.log('✅ Database connection successful');
    
    // Check if tables exist
    const result = await db.execute(sql`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'monitored_emails', 'email_digests', 'user_settings', 'oauth_tokens', 'thematic_digests')
    `);
    
    const tableCount = Number(result.rows[0]?.table_count || 0);
    
    if (tableCount < 6) {
      console.log('⚠️  Missing database tables, running migrations...');
      
      try {
        execSync('npm run db:push', { 
          stdio: 'inherit',
          cwd: process.cwd()
        });
        console.log('✅ Database schema created successfully');
      } catch (error) {
        console.error('❌ Failed to create database schema:', error);
        throw error;
      }
    } else {
      console.log('✅ All required database tables exist');
    }
    
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
      console.log('❌ PostgreSQL is not running. Starting PostgreSQL...');
      
      try {
        // Try to start PostgreSQL using Homebrew
        execSync('brew services start postgresql@14 || brew services start postgresql', { 
          stdio: 'inherit' 
        });
        
        console.log('⏳ Waiting for PostgreSQL to start...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test connection again
        await db.execute(sql`SELECT 1`);
        console.log('✅ PostgreSQL started and connected');
        
        // Run initialization again
        await initializeDatabase();
        
      } catch (startError) {
        console.error('❌ Failed to start PostgreSQL automatically.');
        console.error('Please start PostgreSQL manually:');
        console.error('  brew services start postgresql');
        console.error('  or: docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres');
        throw startError;
      }
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('❌ Database does not exist. Creating database...');
      
      try {
        const dbName = DATABASE_URL.split('/').pop();
        const baseUrl = DATABASE_URL.substring(0, DATABASE_URL.lastIndexOf('/'));
        
        execSync(`createdb ${dbName}`, { stdio: 'inherit' });
        console.log(`✅ Database ${dbName} created`);
        
        // Run initialization again
        await initializeDatabase();
        
      } catch (createError) {
        console.error('❌ Failed to create database:', createError);
        console.error('Please create the database manually:');
        console.error(`  createdb ${DATABASE_URL.split('/').pop()}`);
        throw createError;
      }
    } else {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }
}