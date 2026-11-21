import { describe, expect, it } from 'vitest';
import {
  createLicenseService,
  licenseService,
  normalizeLicenseCode,
  VALID_LICENSE_HASHES,
} from '@/services/licenseService';

const FORMAT_CODE = 'KIN-2099-X7Q42M';

describe('licenseService', () => {
  it('publica al menos un hash comercial en la versión distribuida', () => {
    expect(VALID_LICENSE_HASHES.length).toBeGreaterThan(0);
    expect(new Set(VALID_LICENSE_HASHES).size).toBe(VALID_LICENSE_HASHES.length);
  });

  it('acepta el formato KIN-AAAA-XXXXXX', () => {
    expect(licenseService.isValidFormat(FORMAT_CODE)).toBe(true);
    expect(licenseService.isValidFormat(' kin-2099-x7q42m ')).toBe(true);
  });

  it('rechaza códigos con formato incorrecto', () => {
    expect(licenseService.isValidFormat('X7Q42M-2099-KIN')).toBe(false);
    expect(licenseService.isValidFormat('KIN-99-X7Q42M')).toBe(false);
    expect(licenseService.isValidFormat('KIN-2099-X7Q42M-EXTRA')).toBe(false);
  });

  it('normaliza el código antes de calcular el hash', async () => {
    const expected = await licenseService.hashLicense(FORMAT_CODE);
    const actual = await licenseService.hashLicense(`  ${FORMAT_CODE.toLowerCase()}  `);

    expect(actual).toBe(expected);
    expect(normalizeLicenseCode(`  ${FORMAT_CODE.toLowerCase()}  `)).toBe(FORMAT_CODE);
  });

  it('no valida un código únicamente porque cumple el formato', async () => {
    await expect(licenseService.validateLicense(FORMAT_CODE)).resolves.toBe(false);
  });

  it('valida un código contra un hash inyectado para la prueba', async () => {
    const hash = await licenseService.hashLicense(FORMAT_CODE);
    const validator = createLicenseService([hash]);

    await expect(
      validator.validateLicense(`  ${FORMAT_CODE.toLowerCase()}  `)
    ).resolves.toBe(true);
    await expect(validator.validateLicense('KIN-2099-Z9C42M')).resolves.toBe(false);
  });
});
