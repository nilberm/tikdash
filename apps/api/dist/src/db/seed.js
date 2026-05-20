import { db } from './index.js';
import { users } from './schema.js';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
async function seed() {
    const email = process.env.SEED_USER_EMAIL || 'nilber@tikdash.com';
    const password = process.env.SEED_USER_PASSWORD || 'changeme123';
    console.log(`Seeding initial user (${email})...`);
    const { auth } = await import('../auth.js');
    try {
        const user = await auth.api.signUpEmail({
            body: {
                name: 'Nilber Mota',
                email,
                password,
            }
        });
        console.log('User created successfully:', user);
    }
    catch (err) {
        if (err.message?.includes('already exists') || err.status === 400) {
            console.log('User already exists, skipping.');
        }
        else {
            console.error('Error creating user:', err);
        }
    }
    process.exit(0);
}
seed().catch(console.error);
