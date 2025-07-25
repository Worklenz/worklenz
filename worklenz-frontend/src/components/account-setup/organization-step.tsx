import React, { useEffect, useRef, useState } from 'react';
import { Form, Input, InputRef, Typography, Card, Row, Col, Tag, Tooltip, Button } from '@/shared/antd-imports';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { setOrganizationName } from '@/features/account-setup/account-setup.slice';
import { RootState } from '@/app/store';
import { sanitizeInput } from '@/utils/sanitizeInput';
import './admin-center-common.css';

const { Title, Paragraph, Text } = Typography;

interface Props {
  onEnter: () => void;
  styles: any;
  organizationNamePlaceholder: string;
  organizationNameInitialValue?: string;
  isDarkMode: boolean;
  token?: any;
}

// Organization name suggestions by type
const organizationSuggestions = [
  { category: 'Tech Companies', examples: ['TechCorp', 'DevStudio', 'CodeCraft', 'PixelForge'] },
  { category: 'Creative Agencies', examples: ['Creative Hub', 'Design Studio', 'Brand Works', 'Visual Arts'] },
  { category: 'Consulting', examples: ['Strategy Group', 'Business Solutions', 'Expert Advisors', 'Growth Partners'] },
  { category: 'Startups', examples: ['Innovation Labs', 'Future Works', 'Venture Co', 'Next Gen'] },
];


export const OrganizationStep: React.FC<Props> = ({
  onEnter,
  styles,
  organizationNamePlaceholder,
  organizationNameInitialValue,
  isDarkMode,
  token,
}) => {
  const { t } = useTranslation('account-setup');
  const dispatch = useDispatch();
  const { organizationName } = useSelector((state: RootState) => state.accountSetupReducer);
  const inputRef = useRef<InputRef>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Autofill organization name if not already set
  useEffect(() => {
    if (!organizationName && organizationNameInitialValue) {
      dispatch(setOrganizationName(organizationNameInitialValue));
    }
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const onPressEnter = () => {
    if (!organizationName.trim()) return;
    onEnter();
  };

  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = sanitizeInput(e.target.value);
    dispatch(setOrganizationName(sanitizedValue));
  };

  const handleSuggestionClick = (suggestion: string) => {
    dispatch(setOrganizationName(suggestion));
    inputRef.current?.focus();
    setShowSuggestions(false);
  };

  const toggleSuggestions = () => {
    setShowSuggestions(!showSuggestions);
  };

  return (
    <div className="w-full organization-step">
      {/* Header */}
      <div className="text-center mb-8">
        <Title level={3} className="mb-2" style={{ color: token?.colorText }}>
          {t('organizationStepWelcome')}
        </Title>
        <Paragraph className="text-base" style={{ color: token?.colorTextSecondary }}>
          {t('organizationStepDescription')}
        </Paragraph>
      </div>

      {/* Main Form Card */}
      <div className="mb-6">
        <Card 
          className="border-2 hover:shadow-md transition-all duration-200"
          style={{ 
            borderColor: token?.colorPrimary,
            backgroundColor: token?.colorBgContainer 
          }}
        >
          <Form.Item 
            className="mb-4"
            label={
              <div className="flex items-center space-x-2">
                <span className="font-medium text-base" style={{ color: token?.colorText }}>
                  {t('organizationStepLabel')}
                </span>
                <Tooltip title={t('organizationStepTooltip')}>
                  <span 
                    className="text-sm cursor-help"
                    style={{ color: token?.colorTextTertiary }}
                  >
                    ⓘ
                  </span>
                </Tooltip>
              </div>
            }
          >
            <Input
              size="large"
              placeholder={organizationNamePlaceholder || t('organizationStepPlaceholder')}
              value={organizationName}
              onChange={handleOrgNameChange}
              onPressEnter={onPressEnter}
              ref={inputRef}
              className="text-base"
              style={{
                backgroundColor: token?.colorBgContainer,
                borderColor: token?.colorBorder,
                color: token?.colorText
              }}
            />
          </Form.Item>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button 
              type="link" 
              size="small"
              onClick={toggleSuggestions}
              style={{ color: token?.colorPrimary }}
            >
              💡 {t('organizationStepNeedIdeas')}
            </Button>
            {organizationNameInitialValue && organizationNameInitialValue !== organizationName && (
              <Button 
                type="link" 
                size="small"
                onClick={() => dispatch(setOrganizationName(organizationNameInitialValue))}
                style={{ color: token?.colorTextSecondary }}
              >
                🔄 {t('organizationStepUseDetected')} "{organizationNameInitialValue}"
              </Button>
            )}
          </div>

          {/* Character Count and Validation */}
          <div className="flex justify-between items-center text-sm">
            <Text type="secondary">
              {organizationName.length}/50 {t('organizationStepCharacters')}
            </Text>
            {organizationName.length > 0 && (
              <div className="flex items-center space-x-1">
                {organizationName.length >= 2 ? (
                  <span style={{ color: token?.colorSuccess }}>✓ {t('organizationStepGoodLength')}</span>
                ) : (
                  <span style={{ color: token?.colorWarning }}>⚠ {t('organizationStepTooShort')}</span>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>


      {/* Suggestions Panel */}
      {showSuggestions && (
        <div className="mb-6">
          <Card 
            title={
              <div className="flex items-center space-x-2">
                <span>🎯</span>
                <span>{t('organizationStepSuggestionsTitle')}</span>
              </div>
            }
            style={{ backgroundColor: token?.colorBgContainer }}
          >
            <div className="space-y-4">
              {organizationSuggestions.map((category, categoryIndex) => (
                <div key={categoryIndex}>
                  <div className="mb-2">
                    <Tag 
                      color="blue" 
                      className={`cursor-pointer ${selectedCategory === category.category ? 'opacity-100' : 'opacity-70'}`}
                      onClick={() => setSelectedCategory(
                        selectedCategory === category.category ? null : category.category
                      )}
                    >
                      {t(`organizationStepCategory${categoryIndex + 1}`, category.category)}
                    </Tag>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {category.examples.map((example, exampleIndex) => (
                      <button
                        key={exampleIndex}
                        onClick={() => handleSuggestionClick(example)}
                        className="px-3 py-1 rounded-full text-sm border transition-all duration-200 hover:scale-105 hover:shadow-sm organization-suggestion-button"
                        style={{
                          backgroundColor: token?.colorBgContainer,
                          borderColor: token?.colorBorder,
                          color: token?.colorTextSecondary
                        }}
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t" style={{ borderColor: token?.colorBorder }}>
              <Text type="secondary" className="text-sm">
                💡 {t('organizationStepSuggestionsNote')}
              </Text>
            </div>
          </Card>
        </div>
      )}

      {/* Footer Note */}
      <div 
        className="text-center p-4 rounded-lg"
        style={{ 
          backgroundColor: token?.colorInfoBg,
          borderColor: token?.colorInfoBorder,
          border: '1px solid'
        }}
      >
        <Text type="secondary" className="text-sm">
          🔒 {t('organizationStepPrivacyNote')}
        </Text>
      </div>
    </div>
  );
};