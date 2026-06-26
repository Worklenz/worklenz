import React from 'react';
import { Button, Typography } from '@/shared/antd-imports';

interface ImportCompletionContentProps {
  t: (key: string, defaultValueOrOptions?: any, options?: any) => string;
  handleStartNewImport: () => void;
}

export const ImportCompletionContent: React.FC<ImportCompletionContentProps> = ({
  t,
  handleStartNewImport,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        width: '100%',
        maxWidth: 780,
        margin: '0 auto',
      }}
    >
      <img
        src="https://images.ctfassets.net/rz1oowkt5gyp/2kQEtpSt0aRvFV8aXrudQK/a8a1ea83b9e8b9d68ebf4598d2d9961c/IMPORT_COMPLETED_MAP.png"
        alt="Importing"
        style={{ maxWidth: 640, width: '100%', height: 'auto' }}
      />
      <div style={{ textAlign: 'center', maxWidth: 620 }}>
        <Typography.Title level={3} style={{ marginBottom: 10 }}>
          {t('importStep.importingHeadline', { defaultValue: "We're mapping out the new project" })}
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 14, fontSize: 16 }}>
          {t('importStep.importingSubhead', {
            defaultValue:
              "Take a quick break and we'll do the rest. We'll take you to the project once it's ready.",
          })}
        </Typography.Paragraph>
        <ul style={{ textAlign: 'left', margin: '0 auto 18px', maxWidth: 360, fontSize: 15 }}>
          <li>{t('importStep.importingTask1', { defaultValue: 'Importing project data' })}</li>
          <li>{t('importStep.importingTask2', { defaultValue: 'Setting up user profiles' })}</li>
          <li>{t('importStep.importingTask3', { defaultValue: 'Creating a new project' })}</li>
        </ul>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button size="large" onClick={handleStartNewImport}>
            {t('importStep.startNew', { defaultValue: 'Start a new import' })}
          </Button>
          <Button type="link" size="large">
            {t('importStep.feedback', { defaultValue: 'Give feedback' })}
          </Button>
        </div>
      </div>
    </div>
  );
};
