#!/usr/bin/env node
/**
 * Genera un código de licencia único y su hash PBKDF2.
 * Uso: npm run license:generate -- [código]
 */

const crypto = require('crypto');

const ITERATIONS = 100000;
const SALT = 'kinesia-license-salt-2026';
const CODE_PATTERN = /^KIN-\d{4}-[A-Z0-9]{6}$/;

function generateCode() {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(crypto.randomInt(chars.length));
  }
  return `KIN-${year}-${suffix}`;
}

function hashLicense(code) {
  const key = crypto.pbkdf2Sync(code.trim().toUpperCase(), SALT, ITERATIONS, 32, 'sha256');
  return Buffer.from(key).toString('base64');
}

const requestedCode = process.argv[2]?.trim().toUpperCase();
const code = requestedCode || generateCode();

if (!CODE_PATTERN.test(code)) {
  console.error('Código inválido. Usá el formato KIN-AAAA-XXXXXX (6 letras o números).');
  process.exit(1);
}

const hash = hashLicense(code);

console.log('Código de licencia:', code);
console.log('Hash PBKDF2:', hash);
console.log('');
console.log('Agregá el hash a VALID_LICENSE_HASHES en src/services/licenseService.ts y publicá una nueva versión.');
