import { describe, expect, it } from 'vitest';
import { CSV_MAX_BYTES, CSV_MAX_ROWS, checkCsvFile, parseCsvText } from './csv-import';

describe('parseCsvText', () => {
  it('reads the four columns', () => {
    const result = parseCsvText(
      'Company,First name,Last name,Email\nBeacon Logistics,Jane,Doe,jane@beacon.io\nAvant,Sam,Lee,sam@avant.io\n'
    );

    expect(result).toEqual({
      ok: true,
      rows: [
        {
          company: 'Beacon Logistics',
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@beacon.io',
        },
        { company: 'Avant', first_name: 'Sam', last_name: 'Lee', email: 'sam@avant.io' },
      ],
    });
  });

  it.each([
    ['First Name,Last Name,Email,Company'],
    ['first_name,last_name,email,company'],
    ['FirstName,LastName,EmailAddress,CompanyName'],
    ['GIVEN NAME,SURNAME,E-mail,Organisation'],
  ])('accepts the header spelling %s in any order', header => {
    const result = parseCsvText(`${header}\nJane,Doe,jane@x.io,Beacon\n`);

    // "E-mail" reduces to "email"; the others are listed aliases.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0]).toMatchObject({ first_name: 'Jane', email: 'jane@x.io' });
    }
  });

  it('needs only First name and Email', () => {
    const result = parseCsvText('First name,Email\nJane,jane@x.io\n');

    expect(result).toEqual({
      ok: true,
      rows: [{ company: '', first_name: 'Jane', last_name: '', email: 'jane@x.io' }],
    });
  });

  it('reports which required columns are missing', () => {
    expect(parseCsvText('Company,Last name\nBeacon,Doe\n')).toEqual({
      ok: false,
      error: { kind: 'missingColumns', columns: ['first_name', 'email'] },
    });
    expect(parseCsvText('First name,Company\nJane,Beacon\n')).toEqual({
      ok: false,
      error: { kind: 'missingColumns', columns: ['email'] },
    });
  });

  it('ignores a byte order mark, blank lines and surrounding spaces', () => {
    const result = parseCsvText('﻿First name,Email\n\n  Jane  ,  jane@x.io \n\n');

    expect(result).toEqual({
      ok: true,
      rows: [{ company: '', first_name: 'Jane', last_name: '', email: 'jane@x.io' }],
    });
  });

  it('keeps commas inside quoted cells', () => {
    const result = parseCsvText('Company,First name,Email\n"Beacon, Logistics",Jane,jane@x.io\n');

    expect(result.ok && result.rows[0].company).toBe('Beacon, Logistics');
  });

  it('does not judge the cells: that is the server’s job', () => {
    const result = parseCsvText('First name,Email\n,not-an-email\n');

    expect(result.ok).toBe(true);
  });

  it('says so when there are no data rows', () => {
    expect(parseCsvText('First name,Email\n')).toEqual({ ok: false, error: { kind: 'empty' } });
    expect(parseCsvText('')).toMatchObject({ ok: false });
  });

  it('refuses a file with more rows than an import can take', () => {
    const rows = Array.from({ length: CSV_MAX_ROWS + 1 }, (_, i) => `Person ${i},p${i}@x.io`).join(
      '\n'
    );

    expect(parseCsvText(`First name,Email\n${rows}`)).toEqual({
      ok: false,
      error: { kind: 'tooManyRows', count: CSV_MAX_ROWS + 1 },
    });
  });

  it('accepts exactly the maximum', () => {
    const rows = Array.from({ length: CSV_MAX_ROWS }, (_, i) => `Person ${i},p${i}@x.io`).join(
      '\n'
    );

    expect(parseCsvText(`First name,Email\n${rows}`).ok).toBe(true);
  });

  it('treats an unclosed quote as an unreadable file', () => {
    expect(parseCsvText('First name,Email\n"Jane,jane@x.io\n')).toEqual({
      ok: false,
      error: { kind: 'unreadable' },
    });
  });
});

describe('checkCsvFile', () => {
  it('accepts a .csv of a sensible size, in any letter case', () => {
    expect(checkCsvFile({ name: 'clients.csv', size: 1000 })).toBeNull();
    expect(checkCsvFile({ name: 'CLIENTS.CSV', size: 1000 })).toBeNull();
  });

  it('rejects other file types', () => {
    expect(checkCsvFile({ name: 'clients.xlsx', size: 1000 })).toEqual({ kind: 'notCsv' });
    expect(checkCsvFile({ name: 'clients.csv.exe', size: 1000 })).toEqual({ kind: 'notCsv' });
  });

  it('rejects a file over the size limit', () => {
    expect(checkCsvFile({ name: 'clients.csv', size: CSV_MAX_BYTES + 1 })).toEqual({
      kind: 'tooLarge',
    });
    expect(checkCsvFile({ name: 'clients.csv', size: CSV_MAX_BYTES })).toBeNull();
  });
});
