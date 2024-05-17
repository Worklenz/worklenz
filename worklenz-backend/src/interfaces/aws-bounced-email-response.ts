export interface ISESBouncedRecipient {
  emailAddress: string;
  action: string;
  status: string;
  diagnosticCode: string;
}

export interface ISESBounce {
  feedbackId: string;
  bounceType: string;
  bounceSubType: string;
  bouncedRecipients: ISESBouncedRecipient[];
  timestamp: string;
  remoteMtaIp: string;
  reportingMTA: string;
}

export interface ISESBouncedHeaders {
  name: string;
  value: string;
}

export interface ISESCommonHeaders {
  from: string[];
  to: string[];
  subject: string;
}

export interface ISESBouncedMail {
  timestamp: string;
  source: string;
  sourceArn: string;
  sourceIp: string;
  callerIdentity: string;
  sendingAccountId: string;
  messageId: string;
  destination: string[];
  headersTruncated: boolean;
  headers: ISESBouncedHeaders[];
  commonHeaders: ISESCommonHeaders;
}

export interface ISESBouncedMessage {
  notificationType: string;
  bounce: ISESBounce;
  mail: ISESBouncedMail;
}

export interface ISESBouncedEmailResponse {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Message: ISESBouncedMessage;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  UnsubscribeURL: string;
}
