export interface ISESDeliveryMail {
  timestamp: string;
  source: string;
  sourceArn: string;
  sourceIp: string;
  callerIdentity: string;
  sendingAccountId: string;
  messageId: string;
  destination: string[];
}

export interface ISESDelivery {
  timestamp: string;
  processingTimeMillis: number;
  recipients: string[];
  smtpResponse: string;
  remoteMtaIp: string;
  reportingMTA: string;
}

export interface ISESDeliveryMessage {
  notificationType: string;
  delivery: ISESDelivery;
  mail: ISESDeliveryMail;
}

export interface ISESSendMessage {
  notificationType: string;
  mail: ISESDeliveryMail;
}

export interface ISESRejectMessage {
  notificationType: string;
  mail: ISESDeliveryMail;
  reject: {
    reason: string;
  };
}

export type ISESWebhookMessage = ISESDeliveryMessage | ISESSendMessage | ISESRejectMessage;