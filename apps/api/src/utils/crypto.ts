import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  const secretKey = process.env.AES_SECRET_KEY;
  if (!secretKey || secretKey.length !== 32) {
    throw new Error('AES_SECRET_KEY must be a 32-character string.');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(secretKey), iv);
  
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  const secretKey = process.env.AES_SECRET_KEY;
  if (!secretKey || secretKey.length !== 32) {
    throw new Error('AES_SECRET_KEY must be a 32-character string.');
  }

  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(secretKey), iv);
  
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString();
}
