import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  CheckOutlined,
  DownOutlined,
  EyeOutlined,
  Button,
  Tooltip,
  theme,
} from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleProjectField } from '@/features/projects/projectListFields.slice';

export const ProjectListFieldsDropdown: React.FC = () => {
  const { t } = useTranslation('all-project-list');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();

  const fields = useAppSelector(state => state.projectListFieldsReducer.fields);
  const sortedFields = useMemo(() => [...fields].sort((a, b) => a.order - b.order), [fields]);
  // Favorite and Name are always shown and aren't user-configurable, so they
  // don't belong in the picker.
  const configurableFields = useMemo(
    () => sortedFields.filter(field => field.key !== 'FAVORITE' && field.key !== 'NAME'),
    [sortedFields]
  );

  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  // The panel itself is portaled to <body> (so a scrollable/overflow-clipped
  // toolbar can never crop it) — it lives outside dropdownRef's DOM subtree,
  // so outside-click detection has to check both.
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const rect = dropdownRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.left });
  }, []);

  const handleToggleOpen = () => {
    if (!open) updatePosition();
    setOpen(prev => !prev);
  };

  // Close dropdown when clicking outside, and keep the portaled panel
  // aligned with the button on resize while it's open.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  const visibleCount = useMemo(() => {
    return configurableFields.filter(field => field.visible).length;
  }, [configurableFields]);

  const handleFieldToggle = useCallback(
    (fieldKey: string) => {
      dispatch(toggleProjectField(fieldKey));
    },
    [dispatch]
  );

  const getFieldLabel = useCallback(
    (fieldKey: string) => {
      const keyMappings: Record<string, string> = {
        CLIENT: 'client',
        PRIORITY: 'priority',
        STATUS: 'status',
        TASKS_PROGRESS: 'tasksProgress',
        CATEGORY: 'category',
        UPDATED_AT: 'updated_at',
        END_DATE: 'endDate',
      };

      const translationKey = keyMappings[fieldKey];
      return translationKey ? t(translationKey, { defaultValue: fieldKey }) : fieldKey;
    },
    [t]
  );

  const fieldsTitle = useMemo(() => {
    return visibleCount > 0
      ? t('fieldsWithCount', {
          count: visibleCount,
          defaultValue: 'Fields: {{count}}',
        })
      : t('fieldsText', { defaultValue: 'Fields' });
  }, [visibleCount, t]);

  return (
    <div className="relative" ref={dropdownRef} style={{ flexShrink: 0 }}>
      <Tooltip title={fieldsTitle}>
        <Button
          onClick={handleToggleOpen}
          aria-label={fieldsTitle}
          icon={<EyeOutlined />}
          aria-expanded={open}
          aria-haspopup="true"
          style={{ height: 30, padding: '0 12px', fontSize: 12, borderRadius: 7 }}
        >
          {t('fieldsText', { defaultValue: 'Fields' })}
          <DownOutlined
            style={{
              fontSize: '10px',
              marginLeft: '4px',
              transition: 'transform 0.2s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </Button>
      </Tooltip>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              zIndex: 1050,
              width: '256px',
              backgroundColor: token.colorBgContainer,
              borderRadius: '6px',
              boxShadow:
                '0 3px 6px -4px rgba(0,0,0,.12), 0 6px 16px 0 rgba(0,0,0,.08), 0 9px 28px 8px rgba(0,0,0,.05)',
              border: `1px solid ${token.colorBorder}`,
            }}
          >
          <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '4px' }}>
            {configurableFields.length === 0 ? (
              <div
                style={{
                  padding: '8px',
                  fontSize: '12px',
                  textAlign: 'center',
                  color: token.colorTextSecondary,
                }}
              >
                {t('noOptionsFound', { defaultValue: 'No Options Found' })}
              </div>
            ) : (
              <>
                <div
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: token.colorTextSecondary,
                  }}
                >
                  {t('showFields', { defaultValue: 'Show Fields' })}
                </div>
                {configurableFields.map(field => {
                  const isSelected = field.visible;

                  return (
                    <button
                      key={field.key}
                      onClick={() => handleFieldToggle(field.key)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        fontSize: '13px',
                        borderRadius: '4px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: isSelected ? token.colorText : token.colorTextSecondary,
                        fontWeight: isSelected ? 600 : 400,
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                          token.colorFillSecondary;
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                          'transparent';
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '14px',
                          height: '14px',
                          border: `1px solid ${isSelected ? token.colorPrimary : token.colorBorder}`,
                          borderRadius: '2px',
                          backgroundColor: isSelected ? token.colorPrimary : 'transparent',
                          color: isSelected ? token.colorTextLightSolid : 'transparent',
                        }}
                      >
                        {isSelected && <CheckOutlined style={{ fontSize: '10px' }} />}
                      </div>

                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textAlign: 'left',
                        }}
                      >
                        {getFieldLabel(field.key)}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
          </div>,
          document.body
        )}
    </div>
  );
};
