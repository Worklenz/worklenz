import {
  useGetApprovalsQuery,
  useGetChangeRequestsQuery,
  useGetThreadsQuery,
} from '@/store/api-v2';

export interface NavBadges {
  discussions: number;
  approvals: number;
  changeRequests: number;
}

/**
 * Counts for the sidebar. They only count what this user can act on:
 * approvals they can decide, change requests waiting for their reply, unread threads.
 */
export const useNavBadges = (): NavBadges => {
  const { data: threads } = useGetThreadsQuery();
  const { data: approvals } = useGetApprovalsQuery();
  const { data: changeRequests } = useGetChangeRequestsQuery();

  return {
    discussions: threads?.filter(thread => thread.unread).length ?? 0,
    approvals: approvals?.filter(approval => approval.can_decide).length ?? 0,
    changeRequests: changeRequests?.filter(request => request.needs_your_reply).length ?? 0,
  };
};
