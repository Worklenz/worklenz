import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Input, Select, Space } from '@/shared/antd-imports';
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumber,
  AsYouType,
} from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
// Import flag icons from country-flag-icons
import * as flags from 'country-flag-icons/react/3x2';

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onCountryChange?: (country: CountryCode) => void;
  placeholder?: string;
  disabled?: boolean;
  defaultCountry?: CountryCode;
  style?: React.CSSProperties;
}

// Country names mapping for better UX
const countryNames: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  BE: 'Belgium',
  CH: 'Switzerland',
  AT: 'Austria',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  IE: 'Ireland',
  PT: 'Portugal',
  GR: 'Greece',
  PL: 'Poland',
  CZ: 'Czech Republic',
  HU: 'Hungary',
  RO: 'Romania',
  BG: 'Bulgaria',
  HR: 'Croatia',
  RS: 'Serbia',
  SK: 'Slovakia',
  SI: 'Slovenia',
  LT: 'Lithuania',
  LV: 'Latvia',
  EE: 'Estonia',
  IN: 'India',
  CN: 'China',
  JP: 'Japan',
  KR: 'South Korea',
  SG: 'Singapore',
  HK: 'Hong Kong',
  TW: 'Taiwan',
  MY: 'Malaysia',
  TH: 'Thailand',
  PH: 'Philippines',
  ID: 'Indonesia',
  VN: 'Vietnam',
  NZ: 'New Zealand',
  BR: 'Brazil',
  MX: 'Mexico',
  AR: 'Argentina',
  CL: 'Chile',
  CO: 'Colombia',
  PE: 'Peru',
  VE: 'Venezuela',
  ZA: 'South Africa',
  EG: 'Egypt',
  NG: 'Nigeria',
  KE: 'Kenya',
  IL: 'Israel',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  TR: 'Turkey',
  RU: 'Russia',
  UA: 'Ukraine',
  LK: 'Sri Lanka',
  PK: 'Pakistan',
  BD: 'Bangladesh',
};

// Helper function to get flag emoji from country code with fallback
const getFlagEmoji = (countryCode: string): string => {
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch (error) {
    // Fallback to country code if emoji fails
    return countryCode.toUpperCase();
  }
};

// SVG Flag component using country-flag-icons
const FlagIcon: React.FC<{ countryCode: string; style?: React.CSSProperties }> = ({
  countryCode,
  style = {},
}) => {
  // Get the flag component dynamically
  const FlagComponent = flags[countryCode as keyof typeof flags];

  if (FlagComponent) {
    return (
      <FlagComponent
        style={{
          width: '20px',
          height: '15px',
          borderRadius: '2px',
          objectFit: 'cover',
          ...style,
        }}
        title={`${countryNames[countryCode] || countryCode} flag`}
      />
    );
  }

  // Fallback to emoji if SVG flag is not available
  const flagEmoji = getFlagEmoji(countryCode);
  return (
    <span
      style={{
        fontSize: '16px',
        fontFamily:
          'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Android Emoji, EmojiSymbols, EmojiOne Mozilla, Twemoji Mozilla, Segoe UI Symbol, Noto Emoji',
        lineHeight: 1,
        display: 'inline-block',
        minWidth: '20px',
        textAlign: 'center',
        ...style,
      }}
      title={`${countryNames[countryCode] || countryCode} flag`}
    >
      {flagEmoji}
    </span>
  );
};

const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  onCountryChange,
  placeholder = 'Enter phone number',
  disabled = false,
  defaultCountry = 'US',
  style,
}) => {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(defaultCountry);
  const [phoneNumber, setPhoneNumber] = useState('');
  const isUpdatingRef = useRef(false);

  // Sync with external value changes (form initialization, reset, etc.)
  useEffect(() => {
    // Skip if update originated from user input to prevent circular updates
    if (isUpdatingRef.current) {
      isUpdatingRef.current = false;
      return;
    }

    if (value) {
      try {
        const parsed = parsePhoneNumber(value, defaultCountry);
        if (parsed) {
          const resolvedCountry = parsed.country || defaultCountry;
          setSelectedCountry(resolvedCountry);
          onCountryChange?.(resolvedCountry);
          setPhoneNumber(parsed.nationalNumber);
        } else {
          setSelectedCountry(defaultCountry);
          onCountryChange?.(defaultCountry);
          // Ignore malformed international numbers to prevent display issues
          if (value.startsWith('+')) {
            return;
          }
          setPhoneNumber(value);
        }
      } catch {
        setSelectedCountry(defaultCountry);
        onCountryChange?.(defaultCountry);
        // Ignore malformed international numbers to prevent display issues
        if (value.startsWith('+')) {
          return;
        }
        setPhoneNumber(value);
      }
    } else {
      setSelectedCountry(defaultCountry);
      onCountryChange?.(defaultCountry);
      setPhoneNumber('');
    }
  }, [value, defaultCountry, onCountryChange]);

  const handleCountryChange = (country: CountryCode) => {
    setSelectedCountry(country);
    onCountryChange?.(country);
    isUpdatingRef.current = true;

    if (phoneNumber) {
      const formatter = new AsYouType(country);
      formatter.input(phoneNumber);
      const fullNumber =
        formatter.getNumber()?.number || `+${getCountryCallingCode(country)}${phoneNumber}`;
      onChange?.(fullNumber);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const numericInput = input.replace(/\D/g, '');

    setPhoneNumber(numericInput);
    isUpdatingRef.current = true;

    // Send empty string when input is cleared
    if (!numericInput) {
      onChange?.('');
      return;
    }

    // Format and send international number
    const formatter = new AsYouType(selectedCountry);
    formatter.input(numericInput);

    const phoneNumberObj = formatter.getNumber();
    const fullNumber =
      phoneNumberObj?.number ||
      `+${getCountryCallingCode(selectedCountry)}${numericInput}`;

    onChange?.(fullNumber);
  };

  // Memoize country options for performance
  const countryOptions = useMemo(() => {
    const countries = getCountries();
    const sortedCountries = countries.sort((a, b) => {
      const nameA = countryNames[a] || a;
      const nameB = countryNames[b] || b;
      return nameA.localeCompare(nameB);
    });

    return sortedCountries.map(country => {
      const callingCode = getCountryCallingCode(country);
      const displayName = countryNames[country] || country;

      return {
        value: country,
        label: (
          <Space size={4}>
            <FlagIcon countryCode={country} />
            <span>+{callingCode}</span>
          </Space>
        ),
        searchLabel: `${displayName} +${callingCode} ${country}`,
      };
    });
  }, []);

  return (
    <Input.Group compact style={style}>
      <Select
        showSearch
        value={selectedCountry}
        onChange={handleCountryChange}
        disabled={disabled}
        style={{ width: '40%' }}
        popupMatchSelectWidth={false}
        optionFilterProp="children"
        filterOption={(input, option) =>
          (option?.searchLabel as string)?.toLowerCase().includes(input.toLowerCase())
        }
        options={countryOptions}
      />
      <Input
        value={phoneNumber}
        onChange={handlePhoneChange}
        placeholder={placeholder}
        disabled={disabled}
        inputMode="numeric"
        pattern="[0-9]*"
        style={{ width: '60%' }}
      />
    </Input.Group>
  );
};

export default PhoneInput;
