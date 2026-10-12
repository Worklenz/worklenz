import React from 'react';
import {
  Button,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExportOutlined,
  InfoCircleOutlined,
  Modal,
  PlusCircleOutlined,
  SyncOutlined,
  Typography,
} from '@/shared/antd-imports';
import { WORKLENZ_STATUS_DOCS_URL } from '@/shared/help-links-constants';
import type { TranslateFn, ThemeToken } from '../types';

export interface MappingStatusesInfoModalProps {
  open: boolean;
  onClose: () => void;
  t: TranslateFn;
  themeToken: ThemeToken;
}

export const MappingStatusesInfoModal: React.FC<MappingStatusesInfoModalProps> = ({
  open,
  onClose,
  t,
  themeToken,
}) => {
  const cardStyle: React.CSSProperties = {
    background: themeToken.colorBgElevated,
    border: `1px solid ${themeToken.colorBorderSecondary || themeToken.colorBorder}`,
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 10,
  };

  const handleOpenDocs = () => {
    window.open(WORKLENZ_STATUS_DOCS_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      destroyOnHidden
      zIndex={1100}
      width={580}
      centered
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <InfoCircleOutlined style={{ color: themeToken.colorPrimary, fontSize: 18 }} />
          <span>
            {t('importStep.mappingStatusesInfoTitle', {
              defaultValue: 'About Mapping Statuses',
            })}
          </span>
        </div>
      }
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Button icon={<ExportOutlined />} onClick={handleOpenDocs}>
            {t('importStep.mappingDocsButton', {
              defaultValue: 'Read Status Documentation',
            })}
          </Button>
          <Button type="primary" onClick={onClose}>
            {t('importStep.mappingGotItButton', {
              defaultValue: 'Got It',
            })}
          </Button>
        </div>
      }
    >
      <div style={{ maxHeight: 'calc(70vh - 40px)', overflowY: 'auto', paddingRight: 4 }}>
        <Typography.Paragraph
          style={{
            color: themeToken.colorTextSecondary,
            fontSize: 14,
            marginBottom: 16,
            lineHeight: 1.6,
          }}
        >
          {t('importStep.mappingStatusesInfoIntro', {
            defaultValue:
              'Status mapping matches the status values found in your CSV file to Worklenz workflow statuses, ensuring every imported task lands in the correct stage.',
          })}
        </Typography.Paragraph>

        {/* 1. Status Categories */}
        <div style={cardStyle}>
          <Typography.Text strong style={{ color: themeToken.colorText, fontSize: 14, display: 'block', marginBottom: 6 }}>
            {t('importStep.mappingInfoCategoriesTitle', {
              defaultValue: '1. Worklenz Status Categories',
            })}
          </Typography.Text>
          <Typography.Paragraph
            style={{ color: themeToken.colorTextSecondary, fontSize: 13, marginBottom: 8 }}
          >
            {t('importStep.mappingInfoCategoriesDesc', {
              defaultValue:
                'Every task status in Worklenz belongs to one of three core workflow categories:',
            })}
          </Typography.Paragraph>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClockCircleOutlined style={{ color: themeToken.colorTextTertiary || themeToken.colorTextSecondary }} />
              <Typography.Text style={{ fontSize: 13 }}>
                <strong>{t('importStep.statusTodo', { defaultValue: 'To Do' })}:</strong>{' '}
                <span style={{ color: themeToken.colorTextSecondary }}>
                  {t('importStep.mappingInfoCatTodo', {
                    defaultValue: 'Tasks that have not been started yet.',
                  })}
                </span>
              </Typography.Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SyncOutlined style={{ color: themeToken.colorPrimary }} />
              <Typography.Text style={{ fontSize: 13 }}>
                <strong>{t('importStep.statusDoing', { defaultValue: 'Doing' })}:</strong>{' '}
                <span style={{ color: themeToken.colorTextSecondary }}>
                  {t('importStep.mappingInfoCatDoing', {
                    defaultValue: 'Tasks that are currently in progress.',
                  })}
                </span>
              </Typography.Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleOutlined style={{ color: themeToken.colorSuccess || '#22c55e' }} />
              <Typography.Text style={{ fontSize: 13 }}>
                <strong>{t('importStep.statusDone', { defaultValue: 'Done' })}:</strong>{' '}
                <span style={{ color: themeToken.colorTextSecondary }}>
                  {t('importStep.mappingInfoCatDone', {
                    defaultValue: 'Tasks that have been completed.',
                  })}
                </span>
              </Typography.Text>
            </div>
          </div>
        </div>

        {/* 2. Map to Existing Statuses */}
        <div style={cardStyle}>
          <Typography.Text strong style={{ color: themeToken.colorText, fontSize: 14, display: 'block', marginBottom: 4 }}>
            {t('importStep.mappingInfoMatchTitle', {
              defaultValue: '2. Map to Existing Statuses',
            })}
          </Typography.Text>
          <Typography.Paragraph
            style={{ color: themeToken.colorTextSecondary, fontSize: 13, marginBottom: 0 }}
          >
            {t('importStep.mappingInfoMatchDesc', {
              defaultValue:
                'For each unique value from your CSV Status column on the left, select the matching Worklenz project status from the dropdown on the right.',
            })}
          </Typography.Paragraph>
        </div>

        {/* 3. Create New Statuses */}
        <div style={cardStyle}>
          <Typography.Text strong style={{ color: themeToken.colorText, fontSize: 14, display: 'block', marginBottom: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <PlusCircleOutlined style={{ color: themeToken.colorPrimary }} />
              {t('importStep.mappingInfoCreateTitle', {
                defaultValue: '3. Create New Custom Statuses',
              })}
            </span>
          </Typography.Text>
          <Typography.Paragraph
            style={{ color: themeToken.colorTextSecondary, fontSize: 13, marginBottom: 0 }}
          >
            {t('importStep.mappingInfoCreateDesc', {
              defaultValue:
                'If your CSV contains a status not yet in Worklenz, type the new status name into the search box to create it, then choose which category (To Do, Doing, or Done) it belongs to.',
            })}
          </Typography.Paragraph>
        </div>

        {/* 4. Unmapped Values */}
        <div style={cardStyle}>
          <Typography.Text strong style={{ color: themeToken.colorText, fontSize: 14, display: 'block', marginBottom: 4 }}>
            {t('importStep.mappingInfoUnmappedTitle', {
              defaultValue: '4. Unmapped Statuses',
            })}
          </Typography.Text>
          <Typography.Paragraph
            style={{ color: themeToken.colorTextSecondary, fontSize: 13, marginBottom: 0 }}
          >
            {t('importStep.mappingInfoUnmappedDesc', {
              defaultValue:
                'Any CSV status value left unmapped will automatically be assigned to the project\'s default status upon import so no tasks are lost.',
            })}
          </Typography.Paragraph>
        </div>
      </div>
    </Modal>
  );
};
