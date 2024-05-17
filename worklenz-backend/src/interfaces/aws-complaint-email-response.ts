export interface ISESComplaintMail {
  timestamp: string;
  source: string;
  sourceArn: string;
  sourceIp: string;
  callerIdentity: string;
  sendingAccountId: string;
  messageId: string;
  destination: string[];
}

export interface ISESComplaintEmailAddress {
  emailAddress: string;
}

export interface ISESComplaint {
  feedbackId: string;
  complaintSubType: string | null;
  complainedRecipients: ISESComplaintEmailAddress[];
  timestamp: string;
  userAgent: string;
  complaintFeedbackType: string;
  arrivalDate: string;
}

export interface ISESComplaintMessage {
  notificationType: string;
  complaint: ISESComplaint;
  mail: ISESComplaintMail;
}

export interface ISESComplaintResponse {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Message: ISESComplaintMessage;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  UnsubscribeURL: string;
}
