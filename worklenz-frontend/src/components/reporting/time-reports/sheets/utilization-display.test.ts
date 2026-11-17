import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import en from '../../../../../public/locales/en/time-report.json';
import fr from '../../../../../public/locales/fr/time-report.json';
import { formatUtilizationRange, getUtilizationColor } from './utilization-display';

describe('members utilization display', () => {
  it('shows the configured boundaries for each status and responds to changes', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
    expect(formatUtilizationRange(i18n.t, 'under', 80, 120)).toContain('80%');
    expect(formatUtilizationRange(i18n.t, 'optimal', 80, 120)).toContain('80%-120%');
    expect(formatUtilizationRange(i18n.t, 'over', 80, 120)).toContain('120%');
    expect(formatUtilizationRange(i18n.t, 'under', 70, 120)).toContain('70%');
  });

  it('uses the localized range with interpolation', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: 'fr', resources: { fr: { translation: fr } } });
    expect(formatUtilizationRange(i18n.t, 'under', 80, 120)).toBe('Sous-utilisé (moins de 80 %)');
  });

  it('keeps chart and export colors based on the reported status', () => {
    expect(getUtilizationColor('under')).toBe('#faad14');
    expect(getUtilizationColor('optimal')).toBe('#52c41a');
    expect(getUtilizationColor('over')).toBe('#ef4444');
  });
});
