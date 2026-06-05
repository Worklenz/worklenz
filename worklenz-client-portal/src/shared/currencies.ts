export interface CurrencyOption {
  value: string;
  label: string;
  symbol?: string;
}

// Keep this list in sync with the Finance module currency list in the main
// app (worklenz-frontend/src/shared/currencies.ts). Values are uppercase to
// match the currency codes persisted on invoices.
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { value: 'AED', label: 'AED - UAE Dirham', symbol: 'د.إ' },
  { value: 'AUD', label: 'AUD - Australian Dollar', symbol: 'A$' },
  { value: 'BRL', label: 'BRL - Brazilian Real', symbol: 'R$' },
  { value: 'CAD', label: 'CAD - Canadian Dollar', symbol: 'C$' },
  { value: 'CHF', label: 'CHF - Swiss Franc', symbol: 'CHF' },
  { value: 'CNY', label: 'CNY - Chinese Yuan', symbol: '¥' },
  { value: 'CZK', label: 'CZK - Czech Koruna', symbol: 'Kč' },
  { value: 'DKK', label: 'DKK - Danish Krone', symbol: 'kr' },
  { value: 'EGP', label: 'EGP - Egyptian Pound', symbol: '£' },
  { value: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { value: 'GBP', label: 'GBP - British Pound', symbol: '£' },
  { value: 'HKD', label: 'HKD - Hong Kong Dollar', symbol: 'HK$' },
  { value: 'HUF', label: 'HUF - Hungarian Forint', symbol: 'Ft' },
  { value: 'IDR', label: 'IDR - Indonesian Rupiah', symbol: 'Rp' },
  { value: 'ILS', label: 'ILS - Israeli Shekel', symbol: '₪' },
  { value: 'INR', label: 'INR - Indian Rupee', symbol: '₹' },
  { value: 'JPY', label: 'JPY - Japanese Yen', symbol: '¥' },
  { value: 'KRW', label: 'KRW - South Korean Won', symbol: '₩' },
  { value: 'LKR', label: 'LKR - Sri Lankan Rupee', symbol: 'Rs' },
  { value: 'MXN', label: 'MXN - Mexican Peso', symbol: '$' },
  { value: 'MYR', label: 'MYR - Malaysian Ringgit', symbol: 'RM' },
  { value: 'NOK', label: 'NOK - Norwegian Krone', symbol: 'kr' },
  { value: 'NPR', label: 'NPR - Nepalese Rupee', symbol: 'Rs' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar', symbol: 'NZ$' },
  { value: 'PHP', label: 'PHP - Philippine Peso', symbol: '₱' },
  { value: 'PLN', label: 'PLN - Polish Zloty', symbol: 'zł' },
  { value: 'RUB', label: 'RUB - Russian Ruble', symbol: '₽' },
  { value: 'SAR', label: 'SAR - Saudi Riyal', symbol: '﷼' },
  { value: 'SEK', label: 'SEK - Swedish Krona', symbol: 'kr' },
  { value: 'SGD', label: 'SGD - Singapore Dollar', symbol: 'S$' },
  { value: 'THB', label: 'THB - Thai Baht', symbol: '฿' },
  { value: 'TRY', label: 'TRY - Turkish Lira', symbol: '₺' },
  { value: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { value: 'VND', label: 'VND - Vietnamese Dong', symbol: '₫' },
  { value: 'ZAR', label: 'ZAR - South African Rand', symbol: 'R' },
];

export const DEFAULT_CURRENCY = 'USD';
