import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Input, Select, Space } from '@/shared/antd-imports';
import { getCountries, getCountryCallingCode, parsePhoneNumber, AsYouType } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
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

// Helper function to get flag emoji from country code
const getFlagEmoji = (countryCode: string): string => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
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
        const parsed = parsePhoneNumber(value);
        if (parsed) {
          setSelectedCountry(parsed.country || defaultCountry);
          setPhoneNumber(parsed.nationalNumber);
        } else {
          // Ignore malformed international numbers to prevent display issues
          if (value.startsWith('+')) {
            return;
          }
          setPhoneNumber(value);
        }
      } catch {
        // Ignore malformed international numbers to prevent display issues
        if (value.startsWith('+')) {
          return;
        }
        setPhoneNumber(value);
      }
    } else {
      setPhoneNumber('');
    }
  }, [value, defaultCountry]);

  const handleCountryChange = (country: CountryCode) => {
    setSelectedCountry(country);
    isUpdatingRef.current = true;

    if (phoneNumber) {
      const formatter = new AsYouType(country);
      formatter.input(phoneNumber);
      const fullNumber = formatter.getNumber()?.number || `+${getCountryCallingCode(country)}${phoneNumber}`;
      onChange?.(fullNumber);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    setPhoneNumber(input);
    isUpdatingRef.current = true;

    // Send empty string when input is cleared
    if (!input || input.trim() === '') {
      onChange?.('');
      return;
    }

    // Format and send international number
    const formatter = new AsYouType(selectedCountry);
    formatter.input(input);

    const phoneNumberObj = formatter.getNumber();
    const fullNumber = phoneNumberObj?.number || `+${getCountryCallingCode(selectedCountry)}${input}`;

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

    return sortedCountries.map((country) => {
      const callingCode = getCountryCallingCode(country);
      const displayName = countryNames[country] || country;

      return {
        value: country,
        label: (
          <Space size={4}>
            <span style={{ fontSize: '16px' }}>{getFlagEmoji(country)}</span>
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
        style={{ width: '30%' }}
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
        style={{ width: '70%' }}
      />
    </Input.Group>
  );
};

export default PhoneInput;
