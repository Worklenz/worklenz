import { describe, expect, it } from 'vitest';
import i18n from './i18n';

describe('Italian translations', () => {
  it('loads Italian client portal resources', async () => {
    await i18n.changeLanguage('it');
    expect(i18n.t('signIn.title')).toBe('Accedi');
    await i18n.changeLanguage('en');
  });
});
