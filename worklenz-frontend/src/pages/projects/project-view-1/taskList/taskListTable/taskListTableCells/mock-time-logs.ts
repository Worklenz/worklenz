type TimeLog = {
  logId: number;
  username: string;
  duration: string;
  date: string;
  via?: string;
};

export const mockTimeLogs: TimeLog[] = [
  {
    logId: 1,
    username: 'Sachintha Prasad',
    duration: '1h 0m',
    date: 'Sep 22, 2023, 10:47:02 AM',
  },
  {
    logId: 2,
    username: 'Sachintha Prasad',
    duration: '8h 0m',
    date: 'Sep 22, 2023, 10:47:00 AM',
  },
  {
    logId: 3,
    username: 'Sachintha Prasad',
    duration: '6h 0m',
    date: 'Sep 22, 2023, 10:46:58 AM',
  },
  {
    logId: 4,
    username: 'Raveesha Dilanka',
    duration: '1m 4s',
    date: 'Sep 12, 2023, 8:32:49 AM - Sep 12, 2023, 8:33:53 AM',
    via: 'Timer',
  },
  {
    logId: 5,
    username: 'Raveesha Dilanka',
    duration: '0m 30s',
    date: 'Sep 12, 2023, 8:30:19 AM - Sep 12, 2023, 8:30:49 AM',
    via: 'Timer',
  },
];
