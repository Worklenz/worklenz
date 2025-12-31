import React from 'react';
import { Modal, Button, Typography, Upload, Steps, Collapse, Select, Input, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import Papa from 'papaparse';

interface ImportSourceModalProps {
  open: boolean;
  onClose: () => void;
  source: {
    key: string;
    label: string;
    icon: React.ReactNode;
  } | null;
}

export const ImportSourceModal: React.FC<ImportSourceModalProps> = ({ open, onClose, source }) => {
  const [step, setStep] = React.useState(0);
  const [csvSettingsOpen, setCsvSettingsOpen] = React.useState(false);
  const [configOpen, setConfigOpen] = React.useState(false);
  const [encoding, setEncoding] = React.useState('UTF-8');
  const [delimiter, setDelimiter] = React.useState('');

  // State for CSV columns and mapping
  const [csvColumns, setCsvColumns] = React.useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = React.useState<Record<string, string>>({});
  const [includeInImport, setIncludeInImport] = React.useState<Record<string, boolean>>({});
  // Move users step state (must be top-level)
  const [addUsers, setAddUsers] = React.useState(true);
  const [userEmails, setUserEmails] = React.useState<Record<string, string>>({});

  if (!source) return null;

  const steps = [
    'Upload CSV',
    'Set up space',
    'Map fields',
    'Map values',
    'Move users',
    'Review details',
  ];

  // Example content for each step
  function renderStepContent() {
    switch (step) {
      case 0:
        return (
          <>
            <Typography.Title level={3} style={{ marginBottom: 16, color: '#fff' }}>
              Upload a CSV file
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 24, color: '#b0b0b0' }}>
              Start by finding the <b>Download</b> or <b>Export</b> option on your app and export a
              CSV file.
              <br />
              <a href="#" style={{ color: '#4096ff' }}>
                Structure the CSV
              </a>{' '}
              to ensure the data is in the right format and upload it to begin.
            </Typography.Paragraph>
            <Upload.Dragger
              style={{
                marginBottom: 24,
                background: '#232324',
                border: '1px dashed #333',
                borderRadius: 8,
              }}
              accept=".csv"
              showUploadList={false}
              beforeUpload={file => {
                const reader = new FileReader();
                reader.onload = e => {
                  const text = e.target?.result as string;
                  const parsed = Papa.parse<string[]>(text, { header: true });
                  if (parsed.meta.fields) {
                    setCsvColumns(parsed.meta.fields);
                    // Reset mappings and checkboxes
                    setFieldMappings({});
                    setIncludeInImport(Object.fromEntries(parsed.meta.fields.map(f => [f, true])));
                  }
                };
                reader.readAsText(file);
                return false; // Prevent upload
              }}
            >
              <Button type="primary">Upload CSV file</Button>
            </Upload.Dragger>
            <Collapse
              ghost
              activeKey={csvSettingsOpen ? ['csv'] : []}
              onChange={keys => setCsvSettingsOpen(keys.includes('csv'))}
              style={{ marginBottom: 8 }}
            >
              <Collapse.Panel
                header={<span style={{ color: '#4096ff' }}>CSV file settings</span>}
                key="csv"
                style={{ color: '#fff', background: 'transparent' }}
              >
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 }}>
                  <span>File encoding</span>
                  <Tooltip title="The character encoding of your CSV file.">
                    <InfoCircleOutlined style={{ color: '#4096ff' }} />
                  </Tooltip>
                  <Select
                    value={encoding}
                    onChange={setEncoding}
                    style={{ width: 120 }}
                    options={[
                      { value: 'US-ASCII', label: 'US-ASCII' },
                      { value: 'ISO-8859-1', label: 'ISO-8859-1' },
                      { value: 'UTF-8', label: 'UTF-8' },
                      { value: 'UTF-16BE', label: 'UTF-16BE' },
                      { value: 'UTF-16LE', label: 'UTF-16LE' },
                      { value: 'UTF-16', label: 'UTF-16' },
                    ]}
                  />
                  <span style={{ marginLeft: 32 }}>Delimiter</span>
                  <Tooltip title="The character that separates values in your CSV file.">
                    <InfoCircleOutlined style={{ color: '#4096ff' }} />
                  </Tooltip>
                  <Input
                    value={delimiter}
                    onChange={e => setDelimiter(e.target.value)}
                    style={{ width: 80 }}
                    placeholder=","
                  />
                </div>
              </Collapse.Panel>
            </Collapse>
            <Collapse
              ghost
              activeKey={configOpen ? ['config'] : []}
              onChange={keys => setConfigOpen(keys.includes('config'))}
            >
              <Collapse.Panel
                header={
                  <span style={{ color: '#4096ff' }}>Upload a configuration file (optional)</span>
                }
                key="config"
                style={{ color: '#fff', background: 'transparent' }}
              >
                <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 8 }}>
                  Adding a configuration file will bring in preferences selected in a previous
                  import such as mapped fields and users.{' '}
                  <a href="#" style={{ color: '#4096ff' }}>
                    Learn about using configuration files
                  </a>
                </Typography.Paragraph>
                <Upload disabled>
                  <Button disabled>Upload File</Button>
                </Upload>
              </Collapse.Panel>
            </Collapse>
          </>
        );
      case 1:
        return (
          <div style={{ display: 'flex', flexDirection: 'row', gap: 48, minHeight: 420 }}>
            {/* Left: Form */}
            <div style={{ flex: 1, maxWidth: 420 }}>
              <Typography.Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
                Set up a space in Worklenz
              </Typography.Title>
              <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 16 }}>
                Your team’s data from <b>{source?.label || 'your app'}</b> will be imported into
                this space. Check if you’re selecting the right Worklenz space, template, and space
                type as these options can’t be modified later.
              </Typography.Paragraph>
              <div style={{ color: '#f87171', fontSize: 13, marginBottom: 20 }}>
                All fields are required
              </div>
              {/* Jira space select */}
              <div style={{ marginBottom: 20 }}>
                <Typography.Text style={{ color: '#fff', fontWeight: 500 }}>
                  Jira space
                </Typography.Text>
                <Select
                  style={{ width: '100%', marginTop: 6 }}
                  defaultValue="software"
                  dropdownStyle={{ background: '#23272f', color: '#fff' }}
                  optionLabelProp="label"
                >
                  <Select.Option value="software" label="Software space">
                    <span style={{ color: '#fff' }}>
                      &lt;/&gt; Software space{' '}
                      <span
                        style={{
                          background: '#0052CC',
                          color: '#fff',
                          borderRadius: 4,
                          fontSize: 12,
                          padding: '2px 8px',
                          marginLeft: 8,
                        }}
                      >
                        RECOMMENDED
                      </span>
                    </span>
                  </Select.Option>
                  <Select.Option value="business" label="Business space">
                    <span style={{ color: '#fff' }}>Business space</span>
                  </Select.Option>
                </Select>
              </div>
              {/* Template select */}
              <div style={{ marginBottom: 20 }}>
                <Typography.Text style={{ color: '#fff', fontWeight: 500 }}>
                  Template
                </Typography.Text>
                <Select
                  style={{ width: '100%', marginTop: 6 }}
                  defaultValue="scrum"
                  dropdownStyle={{ background: '#23272f', color: '#fff' }}
                  optionLabelProp="label"
                >
                  <Select.Option value="scrum" label="Scrum">
                    <span role="img" aria-label="Scrum" style={{ marginRight: 8 }}>
                      🏉
                    </span>
                    Scrum
                  </Select.Option>
                  <Select.Option value="kanban" label="Kanban">
                    <span role="img" aria-label="Kanban" style={{ marginRight: 8 }}>
                      🗂️
                    </span>
                    Kanban
                  </Select.Option>
                </Select>
              </div>
              {/* Space name input */}
              <div style={{ marginBottom: 20 }}>
                <Typography.Text style={{ color: '#fff', fontWeight: 500 }}>
                  Space name
                </Typography.Text>
                <Input
                  style={{
                    width: '100%',
                    marginTop: 6,
                    background: '#18181a',
                    color: '#fff',
                    border: '1px solid #333',
                  }}
                  placeholder="Project name"
                />
              </div>
              {/* Show more (collapsible) */}
              <div style={{ marginBottom: 8 }}>
                <a style={{ color: '#4096ff', fontSize: 14 }} href="#">
                  &gt; Show more
                </a>
              </div>
            </div>
            {/* Right: Illustration (optional, can be replaced with SVG or image) */}
            <div
              style={{
                width: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 320,
                  height: 180,
                  background: '#18181a',
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 16px 0 #b3c6e6',
                }}
              >
                {/* Placeholder for board illustration */}
                <svg
                  width="220"
                  height="120"
                  viewBox="0 0 220 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="0" y="0" width="220" height="120" rx="12" fill="#23272f" />
                  <rect x="16" y="20" width="36" height="80" rx="4" fill="#333" />
                  <rect x="60" y="20" width="36" height="80" rx="4" fill="#333" />
                  <rect x="104" y="20" width="36" height="80" rx="4" fill="#333" />
                  <rect x="148" y="20" width="36" height="80" rx="4" fill="#333" />
                  <rect x="192" y="20" width="12" height="80" rx="4" fill="#23272f" />
                  <rect x="20" y="28" width="28" height="12" rx="2" fill="#23272f" />
                  <rect x="64" y="28" width="28" height="12" rx="2" fill="#23272f" />
                  <rect x="108" y="28" width="28" height="12" rx="2" fill="#23272f" />
                  <rect x="152" y="28" width="28" height="12" rx="2" fill="#23272f" />
                </svg>
              </div>
            </div>
          </div>
        );
      case 2:
        // --- Map space fields step ---
        return (
          <div style={{ width: '100%' }}>
            <Typography.Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
              Map space fields
            </Typography.Title>
            <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 16 }}>
              We’ve automatically mapped a few columns from the CSV file to Jira fields. Verify and{' '}
              <a href="#" style={{ color: '#4096ff' }}>
                map any remaining columns
              </a>
              . Map issue type field to bring in issue type values and map issue ID and parent
              fields to establish hierarchies.{' '}
              <a href="#" style={{ color: '#4096ff' }}>
                Read about mapping issue types
              </a>
            </Typography.Paragraph>
            {/* Date and time format options (collapsible) */}
            <Collapse ghost style={{ marginBottom: 16 }} bordered={false} expandIconPosition="left">
              <Collapse.Panel
                header={
                  <span style={{ color: '#4096ff', fontSize: 15 }}>
                    &gt; Date and time format options
                  </span>
                }
                key="dateTimeFormat"
                style={{ background: 'transparent', border: 'none', padding: 0 }}
              >
                <div style={{ display: 'flex', gap: 24, marginBottom: 8, marginTop: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <Typography.Text style={{ color: '#fff', fontWeight: 500, marginBottom: 2 }}>
                      Date and time format<span style={{ color: '#ff4d4f' }}>*</span>
                    </Typography.Text>
                    <Input
                      placeholder="dd/MMM/yy h:mm a"
                      style={{
                        width: '100%',
                        background: '#18181a',
                        color: '#fff',
                        border: '1px solid #333',
                      }}
                    />
                    <Typography.Text style={{ color: '#888', fontSize: 12 }}>
                      e.g. dd/MMM/yy h:mm a
                    </Typography.Text>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <Typography.Text style={{ color: '#fff', fontWeight: 500, marginBottom: 2 }}>
                      Locale
                    </Typography.Text>
                    <Select defaultValue="en" style={{ width: '100%' }}>
                      <Select.Option value="en">English (US)</Select.Option>
                      <Select.Option value="fr">French (FR)</Select.Option>
                      <Select.Option value="de">German (DE)</Select.Option>
                      {/* Add more locales as needed */}
                    </Select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <Typography.Text style={{ color: '#fff', fontWeight: 500, marginBottom: 2 }}>
                      Timezone
                    </Typography.Text>
                    <Select defaultValue="colombo" style={{ width: '100%' }}>
                      <Select.Option value="colombo">Asia/Colombo (UTC+5:30)</Select.Option>
                      <Select.Option value="newyork">America/New_York (UTC-5)</Select.Option>
                      <Select.Option value="london">Europe/London (UTC+0)</Select.Option>
                      {/* Add more timezones as needed */}
                    </Select>
                  </div>
                </div>
              </Collapse.Panel>
            </Collapse>
            {/* Search and filter row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <Input
                placeholder="Search columns in CSV"
                style={{
                  width: 260,
                  background: '#18181a',
                  color: '#fff',
                  border: '1px solid #333',
                }}
              />
              <Select defaultValue="all" style={{ width: 120 }}>
                <Select.Option value="all">Fields: All</Select.Option>
                <Select.Option value="mapped">Mapped</Select.Option>
                <Select.Option value="unmapped">Unmapped</Select.Option>
              </Select>
            </div>
            {/* Table header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: '#b0b0b0',
                fontWeight: 500,
                fontSize: 14,
                marginBottom: 4,
                marginTop: 16,
              }}
            >
              <span style={{ flex: 2, paddingLeft: 8 }}>Columns in CSV</span>
              <span style={{ flex: 2 }}>Jira fields</span>
              <span style={{ width: 140, textAlign: 'center' }}>Include in import</span>
            </div>
            {/* Mapping rows for each CSV column */}
            {csvColumns.length === 0 ? (
              <div style={{ color: '#888', margin: '24px 0' }}>
                Upload a CSV file to map fields.
              </div>
            ) : (
              csvColumns.map(col => (
                <div
                  key={col}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#23272f',
                    borderRadius: 6,
                    marginBottom: 4,
                    minHeight: 44,
                  }}
                >
                  <span style={{ flex: 2, paddingLeft: 8, color: '#fff' }}>{col}</span>
                  <span style={{ flex: 2 }}>
                    <Select
                      placeholder="Select a field to map"
                      style={{ width: '100%' }}
                      showSearch
                      value={fieldMappings[col] || undefined}
                      onChange={val => setFieldMappings(m => ({ ...m, [col]: val }))}
                    >
                      <Select.Option value="assignee">Assignee</Select.Option>
                      <Select.Option value="attachment">Attachment</Select.Option>
                      <Select.Option value="comment">Comment</Select.Option>
                      <Select.Option value="created">Created</Select.Option>
                      <Select.Option value="creator">Creator</Select.Option>
                      <Select.Option value="description">Description</Select.Option>
                      <Select.Option value="duedate">Due date</Select.Option>
                      <Select.Option value="environment">Environment</Select.Option>
                      <Select.Option value="issuetype">Issue Type</Select.Option>
                      <Select.Option value="labels">Labels</Select.Option>
                      {/* ...more fields... */}
                      <Select.Option value="custom">Create a new custom field</Select.Option>
                    </Select>
                  </span>
                  <span style={{ width: 140, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={includeInImport[col] !== false}
                      onChange={e => setIncludeInImport(i => ({ ...i, [col]: e.target.checked }))}
                      style={{ accentColor: '#4096ff', width: 18, height: 18 }}
                    />
                  </span>
                </div>
              ))
            )}
          </div>
        );
      case 3:
        return (
          <Typography.Title level={3} style={{ color: '#fff' }}>
            Map values (step 4)
          </Typography.Title>
        );
      case 4:
        // Move users step
        // For demo, use first 5 CSV columns as 'users' (replace with real user extraction logic as needed)
        const userRows = csvColumns.slice(0, 5);
        return (
          <div style={{ width: '100%' }}>
            <Typography.Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
              Move users to Jira
            </Typography.Title>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div
                style={{
                  background: addUsers ? '#22c55e' : '#23272f',
                  borderRadius: 16,
                  width: 48,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: addUsers ? 'flex-end' : 'flex-start',
                  padding: 4,
                  cursor: 'pointer',
                  marginRight: 12,
                  transition: 'background 0.2s',
                }}
                onClick={() => setAddUsers(v => !v)}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 4px #0002',
                    transition: 'all 0.2s',
                  }}
                />
              </div>
              <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 18 }}>
                Add users into your space
              </span>
            </div>
            <Typography.Paragraph style={{ color: '#b0b0b0', marginBottom: 20 }}>
              Enter a valid email address next to the user information to add a user to the space.
              Users without a corresponding email address won’t be imported.
            </Typography.Paragraph>
            {/* Table header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: '#b0b0b0',
                fontWeight: 500,
                fontSize: 15,
                marginBottom: 4,
              }}
            >
              <span style={{ flex: 2, paddingLeft: 8 }}>
                <span style={{ marginRight: 8 }}>📄</span>Users in CSV ({userRows.length})
              </span>
              <span style={{ width: 40 }}></span>
              <span style={{ flex: 3 }}>
                <span style={{ marginRight: 8 }}>🛫</span>Users moving to Jira (0)
              </span>
            </div>
            {/* User mapping rows */}
            {userRows.length === 0 ? (
              <div style={{ color: '#888', margin: '24px 0' }}>No users found in CSV.</div>
            ) : (
              userRows.map((user, idx) => (
                <div
                  key={user + idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#23272f',
                    borderRadius: 6,
                    marginBottom: 4,
                    minHeight: 44,
                  }}
                >
                  <span style={{ flex: 2, paddingLeft: 8, color: '#fff' }}>{user}</span>
                  <span style={{ width: 40, textAlign: 'center', color: '#4096ff', fontSize: 20 }}>
                    &rarr;
                  </span>
                  <span style={{ flex: 3 }}>
                    <Input
                      placeholder="Enter email"
                      value={userEmails[user] || ''}
                      onChange={e =>
                        setUserEmails(emails => ({ ...emails, [user]: e.target.value }))
                      }
                      style={{
                        width: '100%',
                        background: '#18181a',
                        color: '#fff',
                        border: '1px solid #333',
                      }}
                    />
                  </span>
                </div>
              ))
            )}
          </div>
        );
      case 5:
        return (
          <Typography.Title level={3} style={{ color: '#fff' }}>
            Review details (step 6)
          </Typography.Title>
        );
      default:
        return null;
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="1800px"
      style={{
        top: 8,
        maxWidth: '2000px',
        minWidth: 1500,
        minHeight: 1000,
        height: '90vh',
        padding: 0,
      }}
      bodyStyle={{
        padding: 0,
        background: '#23272f',
        borderRadius: 16,
        minHeight: 900,
        height: '80vh',
      }}
      destroyOnClose
      centered
    >
      {/* Stepper */}
      <div
        style={{
          padding: '32px 48px 0 48px',
          background: '#23272f',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
      >
        <Steps current={step} labelPlacement="vertical" items={steps.map(title => ({ title }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', minHeight: 420, background: '#23272f' }}>
        <div
          style={{
            flex: 1,
            padding: '48px 48px 24px 48px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {renderStepContent()}
        </div>
        <div
          style={{
            width: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#e9eef6',
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
          }}
        >
          {/* Placeholder for illustration, you can replace with an SVG or image */}
          <div
            style={{
              width: 320,
              height: 180,
              background: '#fff',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 16px 0 #b3c6e6',
            }}
          >
            {/* You can replace this with a real SVG illustration */}
            <span style={{ fontSize: 64 }}>{source.icon}</span>
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          background: '#23272f',
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
          padding: '16px 32px 16px 0',
          borderTop: '1px solid #232324',
        }}
      >
        <Button onClick={step === 0 ? onClose : () => setStep(step - 1)} style={{ marginRight: 8 }}>
          {step === 0 ? 'Back' : 'Previous'}
        </Button>
        <Button
          type="primary"
          onClick={() => setStep(s => Math.min(s + 1, steps.length - 1))}
          disabled={step === steps.length - 1}
        >
          {step === steps.length - 1 ? 'Finish' : 'Next'}
        </Button>
      </div>
    </Modal>
  );
};
export default ImportSourceModal;
