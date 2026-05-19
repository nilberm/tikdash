import { db } from './index.js';
import { users } from './schema.js';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function seed() {
  const email = 'admin@tikdash.local';
  
  // Basic Better Auth password hash implementation or standard hash (just a placeholder if using plain passwords isn't allowed)
  // To use better-auth with email/password, usually we create a user using the auth instance directly, 
  // but doing it directly in DB is also fine for seed.
  // Better Auth email/password uses bcrypt.
  
  console.log('Seeding initial user...');
  
  // We can just use the auth client if we want, but directly inserting is faster:
  // Using a known hash for "password123":
  // Wait, better auth might expect the password in the accounts table or a specific format.
  // Let's actually use the auth instance to create the user to ensure it's correct.
  const { auth } = await import('../auth.js');
  
  try {
    const user = await auth.api.signUpEmail({
      body: {
        name: 'Admin',
        email,
        password: 'password123',
      }
    });
    console.log('User created:', user);
  } catch (err: any) {
    if (err.message?.includes('already exists') || err.status === 400) {
      console.log('User already exists, skipping.');
    } else {
      console.error('Error creating user:', err);
    }
  }

  process.exit(0);
}

seed().catch(console.error);
