import { SlackIntegration } from '@/components/settings/integrations/SlackIntegration';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';

const IntegrationsSettings = () => {
  useDocumentTitle('Slack Integration');
  return (
    <div className="space-y-6">
      <SlackIntegration />
    </div>
  );
};

export default IntegrationsSettings;
