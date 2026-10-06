import { describe, it, expect } from 'vitest';
import seatLimitReducer, {
  openSeatLimitModal,
  closeSeatLimitModal,
  clearPendingInvite,
} from '../seatLimitSlice';

describe('seatLimitSlice', () => {
  const initialSeatLimitState = {
    isModalOpen: false,
    seatLimitData: null,
    pendingInvite: null,
  };

  const sampleSeatLimitData = {
    error_code: 'SEAT_LIMIT_EXCEEDED',
    current_members: 10,
    plan_seat_limit: 10,
    business_plan_limit: 25,
    is_appsumo_user: false,
    subscription_type: 'TRIAL',
  };

  const samplePendingInvite = {
    type: 'team' as const,
    data: { email: 'invitee@worklenz.com', role: 'member' },
    projectId: 'p-123',
    projectName: 'Acme Project',
  };

  it('should return the initial state by default', () => {
    const state = seatLimitReducer(undefined, { type: 'unknown' });
    expect(state).toEqual(initialSeatLimitState);
  });

  it('should handle openSeatLimitModal', () => {
    const nextState = seatLimitReducer(
      initialSeatLimitState,
      openSeatLimitModal({
        seatLimitData: sampleSeatLimitData,
        pendingInvite: samplePendingInvite,
      })
    );

    expect(nextState.isModalOpen).toBe(true);
    expect(nextState.seatLimitData).toEqual(sampleSeatLimitData);
    expect(nextState.pendingInvite).toEqual(samplePendingInvite);
  });

  it('should handle closeSeatLimitModal', () => {
    const openState = {
      isModalOpen: true,
      seatLimitData: sampleSeatLimitData,
      pendingInvite: samplePendingInvite,
    };

    const nextState = seatLimitReducer(openState, closeSeatLimitModal());

    expect(nextState.isModalOpen).toBe(false);
    expect(nextState.seatLimitData).toBeNull();
    expect(nextState.pendingInvite).toBeNull();
  });

  it('should handle clearPendingInvite without closing modal or clearing seatLimitData', () => {
    const openState = {
      isModalOpen: true,
      seatLimitData: sampleSeatLimitData,
      pendingInvite: samplePendingInvite,
    };

    const nextState = seatLimitReducer(openState, clearPendingInvite());

    expect(nextState.isModalOpen).toBe(true);
    expect(nextState.seatLimitData).toEqual(sampleSeatLimitData);
    expect(nextState.pendingInvite).toBeNull();
  });
});
