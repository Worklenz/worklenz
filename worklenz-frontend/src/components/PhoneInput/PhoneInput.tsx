import React, { useState, useEffect } from 'react';
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

// Country names mapping
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

  // Parse initial value
  useEffect(() => {
    if (value) {
      try {
        const parsed = parsePhoneNumber(value);
        if (parsed) {
          setSelectedCountry(parsed.country || defaultCountry);
          setPhoneNumber(parsed.nationalNumber);
        } else {
          setPhoneNumber(value);
        }
      } catch {
        setPhoneNumber(value);
      }
    }
  }, [value, defaultCountry]);

  const handleCountryChange = (country: CountryCode) => {
    setSelectedCountry(country);

    // Reformat phone number with new country
    if (phoneNumber) {
      const formatter = new AsYouType(country);
      const formatted = formatter.input(phoneNumber);
      const fullNumber = formatter.getNumber()?.number || `+${getCountryCallingCode(country)}${phoneNumber}`;
      onChange?.(fullNumber);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Format as user types
    const formatter = new AsYouType(selectedCountry);
    const formatted = formatter.input(input);

    setPhoneNumber(input);

    // Get the complete international number
    const phoneNumberObj = formatter.getNumber();
    const fullNumber = phoneNumberObj?.number || `+${getCountryCallingCode(selectedCountry)}${input}`;

    onChange?.(fullNumber);
  };

  // Get all countries and sort them
  const countries = getCountries();
  const sortedCountries = countries.sort((a, b) => {
    const nameA = countryNames[a] || a;
    const nameB = countryNames[b] || b;
    return nameA.localeCompare(nameB);
  });

  // Country selector options
  const countryOptions = sortedCountries.map((country) => {
    const callingCode = getCountryCallingCode(country);
    const displayName = countryNames[country] || country;

    return {
      value: country,
      label: (
        <Space size={4}>
          <span style={{ fontSize: '16px' }}>{getFlagEmoji(country)}</span>
          <span>{country}</span>
        </Space>
      ),
      searchLabel: `${displayName} +${callingCode} ${country}`,
    };
  });

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

// Helper function to get flag emoji from country code
function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export default PhoneInput;
