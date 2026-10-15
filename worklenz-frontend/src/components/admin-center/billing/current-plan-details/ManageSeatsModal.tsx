import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, InputNumber, Modal, Typography, message } from '@/shared/antd-imports';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fetchBillingInfo } from '@/features/admin-center/admin-center.slice';
import { billingApiService } from '@/api/admin-center/billing.api.service';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_billing_add_more_seats } from '@/shared/worklenz-analytics-events';
import logger from '@/utils/errorLogger';
import '../drawers/upgrade-plans-per-user/per-user-upgrade-plans.css';

const MAX_SEATS = 10000;
// The new seat count lands once Paddle's webhook is processed, so refresh a few times.
const REFRESH_DELAYS_MS = [0, 3000, 6000];

interface ManageSeatsModalProps {
  open: boolean;
  onClose: () => void;
  /** Seats currently paid for. */
  totalSeats: number;
  /** Active members; seats can never go below this. */
  usedSeats: number;
  currency?: string;
  /** Price per user for one month, in `currency`. */
  monthlyUnitPrice: number;
  /** Total per user for a year when billed annually; omit for monthly billing. */
  annualUnitPrice?: number;
}

/** Change the number of paid seats on a Paddle Billing subscription, without touching the plan. */
const ManageSeatsModal: React.FC<ManageSeatsModalProps> = ({
  open,
  onClose,
  totalSeats,
  usedSeats,
  currency = 'USD',
  monthlyUnitPrice,
  annualUnitPrice,
}) => {
  const { t } = useTranslation('admin-center/current-bill');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const minSeats = Math.max(1, usedSeats);

  const [seats, setSeats] = useState<number>(totalSeats);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSeats(totalSeats);
  }, [open, totalSeats]);

  const clamp = (next: number) => Math.min(MAX_SEATS, Math.max(0, Math.floor(next) || 0));
  const belowMinimum = seats < minSeats;
  const unchanged = seats === totalSeats;
  const delta = seats - totalSeats;
  const money = (amount: number) => `${currency} ${amount.toFixed(2)}`;

  const handleSave = async () => {
    if (belowMinimum || unchanged) return;
    setSaving(true);
    try {
      const response = await billingApiService.purchaseMoreSeats(seats);
      if (!response.done) throw new Error(response.message || 'Seat update failed');
      trackMixpanelEvent(evt_billing_add_more_seats);
      message.success(t('seatsUpdated', { defaultValue: 'Seats updated.' }));
      REFRESH_DELAYS_MS.forEach(delay => setTimeout(() => dispatch(fetchBillingInfo()), delay));
      onClose();
    } catch (error) {
      message.error(
        t('seatsUpdateFailed', { defaultValue: 'Could not update seats. Please try again.' })
      );
      logger.error('Error updating seats', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('manageSeats', { defaultValue: 'Manage seats' })}
      open={open}
      onCancel={onClose}
      centered
      width={460}
      footer={
        <Flex justify="end" gap={8}>
          <Button onClick={onClose}>{t('cancel', { defaultValue: 'Cancel' })}</Button>
          <Button
            type="primary"
            loading={saving}
            disabled={belowMinimum || unchanged || seats > MAX_SEATS}
            onClick={handleSave}
          >
            {t('updateSeats', { defaultValue: 'Update seats' })}
          </Button>
        </Flex>
      }
    >
      <Flex vertical gap={16} style={{ marginTop: 8 }}>
        <Typography.Text type="secondary">
          {t('seatsInUse', {
            defaultValue: '{{used}} of {{total}} seats are in use.',
            used: usedSeats,
            total: totalSeats,
          })}
        </Typography.Text>

        <Flex align="center" gap={12}>
          <Typography.Text id="manage-seats-label">
            {t('seatsLabel', { defaultValue: 'Seats:' })}
          </Typography.Text>
          <Flex>
            <Button
              aria-label={t('decreaseSeats', { defaultValue: 'Decrease seats' })}
              icon={<MinusOutlined />}
              disabled={seats <= minSeats}
              onClick={() => setSeats(clamp(seats - 1))}
              style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            />
            <InputNumber
              controls={false}
              precision={0}
              max={MAX_SEATS}
              value={seats}
              status={belowMinimum ? 'error' : undefined}
              aria-labelledby="manage-seats-label"
              style={{ width: 80, borderRadius: 0 }}
              className="seat-stepper-input"
              onChange={next => typeof next === 'number' && setSeats(clamp(next))}
              onBlur={() => seats <= 0 && setSeats(minSeats)}
            />
            <Button
              aria-label={t('increaseSeats', { defaultValue: 'Increase seats' })}
              icon={<PlusOutlined />}
              disabled={seats >= MAX_SEATS}
              onClick={() => setSeats(clamp(Math.max(seats, minSeats - 1) + 1))}
              style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
            />
          </Flex>
        </Flex>

        {belowMinimum ? (
          <Typography.Text type="danger" role="alert">
            {t('seatsBelowMinimum', {
              defaultValue: "Seats can't be fewer than your {{count}} active members.",
              count: minSeats,
            })}
          </Typography.Text>
        ) : (
          <Flex vertical gap={4}>
            <Typography.Text strong>
              {t('seatsNewTotal', {
                defaultValue: '{{total}} per month for {{count}} seats',
                total: money(monthlyUnitPrice * seats),
                count: seats,
              })}
            </Typography.Text>
            {annualUnitPrice !== undefined && (
              <Typography.Text type="secondary">
                {t('seatsBilledAnnually', {
                  defaultValue: 'Billed annually: {{total}}',
                  total: money(annualUnitPrice * seats),
                })}
              </Typography.Text>
            )}
            {!unchanged && (
              <Typography.Text type="secondary">
                {delta > 0
                  ? t('seatsProrationAdd', {
                      defaultValue:
                        'The prorated cost of the added seats for the current period is added to your next invoice.',
                    })
                  : t('seatsProrationRemove', {
                      defaultValue:
                        'The unused portion of the removed seats is credited to your next invoice.',
                    })}
              </Typography.Text>
            )}
          </Flex>
        )}
      </Flex>
    </Modal>
  );
};

export default ManageSeatsModal;
