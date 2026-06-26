import Flex from 'antd/es/flex';
import Typography from 'antd/es/typography';

import { colors } from '@/styles/colors';
import { greetingString } from '@/utils/greetingString';
import { getUserSession } from '@/utils/session-helper';
import { currentDateString } from '@/utils/current-date-string';

const GreetingWithTime = () => {
  const userDetails = getUserSession();
  const firstName = userDetails?.name?.split(' ')[0] || '';

  const greet = greetingString(firstName);

  return (
    <Flex vertical gap={8} align="center">
      <Typography.Title level={3} style={{ fontWeight: 500, marginBlock: 0 }}>
        {greet}
      </Typography.Title>
      <Typography.Title
        level={4}
        style={{ fontSize: 16, fontWeight: 400, marginBlock: 0, color: colors.skyBlue }}
      >
        {currentDateString()}
      </Typography.Title>
    </Flex>
  );
};

export default GreetingWithTime;
