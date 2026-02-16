export interface CurrencyOption {
  value: string;
  label: string;
  symbol?: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { value: 'aed', label: 'AED - UAE Dirham', symbol: 'د.إ' },
  { value: 'aud', label: 'AUD - Australian Dollar', symbol: 'A$' },
  { value: 'brl', label: 'BRL - Brazilian Real', symbol: 'R$' },
  { value: 'cad', label: 'CAD - Canadian Dollar', symbol: 'C$' },
  { value: 'chf', label: 'CHF - Swiss Franc', symbol: 'CHF' },
  { value: 'cny', label: 'CNY - Chinese Yuan', symbol: '¥' },
  { value: 'czk', label: 'CZK - Czech Koruna', symbol: 'Kč' },
  { value: 'dkk', label: 'DKK - Danish Krone', symbol: 'kr' },
  { value: 'egp', label: 'EGP - Egyptian Pound', symbol: '£' },
  { value: 'eur', label: 'EUR - Euro', symbol: '€' },
  { value: 'gbp', label: 'GBP - British Pound', symbol: '£' },
  { value: 'hkd', label: 'HKD - Hong Kong Dollar', symbol: 'HK$' },
  { value: 'huf', label: 'HUF - Hungarian Forint', symbol: 'Ft' },
  { value: 'idr', label: 'IDR - Indonesian Rupiah', symbol: 'Rp' },
  { value: 'ils', label: 'ILS - Israeli Shekel', symbol: '₪' },
  { value: 'inr', label: 'INR - Indian Rupee', symbol: '₹' },
  { value: 'jpy', label: 'JPY - Japanese Yen', symbol: '¥' },
  { value: 'krw', label: 'KRW - South Korean Won', symbol: '₩' },
  { value: 'lkr', label: 'LKR - Sri Lankan Rupee', symbol: 'Rs' },
  { value: 'mxn', label: 'MXN - Mexican Peso', symbol: '$' },
  { value: 'myr', label: 'MYR - Malaysian Ringgit', symbol: 'RM' },
  { value: 'nok', label: 'NOK - Norwegian Krone', symbol: 'kr' },
  { value: 'npr', label: 'NPR - Nepalese Rupee', symbol: 'Rs' },
  { value: 'nzd', label: 'NZD - New Zealand Dollar', symbol: 'NZ$' },
  { value: 'php', label: 'PHP - Philippine Peso', symbol: '₱' },
  { value: 'pln', label: 'PLN - Polish Zloty', symbol: 'zł' },
  { value: 'rub', label: 'RUB - Russian Ruble', symbol: '₽' },
  { value: 'sar', label: 'SAR - Saudi Riyal', symbol: '﷼' },
  { value: 'sek', label: 'SEK - Swedish Krona', symbol: 'kr' },
  { value: 'sgd', label: 'SGD - Singapore Dollar', symbol: 'S$' },
  { value: 'thb', label: 'THB - Thai Baht', symbol: '฿' },
  { value: 'try', label: 'TRY - Turkish Lira', symbol: '₺' },
  { value: 'usd', label: 'USD - US Dollar', symbol: '$' },
  { value: 'vnd', label: 'VND - Vietnamese Dong', symbol: '₫' },
  { value: 'zar', label: 'ZAR - South African Rand', symbol: 'R' },
];

export const DEFAULT_CURRENCY = 'usd';

export const getCurrencySymbol = (currencyCode: string): string => {
  const currency = CURRENCY_OPTIONS.find(c => c.value === currencyCode.toLowerCase());
  return currency?.symbol || currencyCode.toUpperCase();
};

export const getCurrencyLabel = (currencyCode: string): string => {
  const currency = CURRENCY_OPTIONS.find(c => c.value === currencyCode.toLowerCase());
  return currency?.label || currencyCode.toUpperCase();
};
