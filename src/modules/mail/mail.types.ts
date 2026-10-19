/**
 * Mail module contracts. ADR 0004 governs: a narrow interface with exactly two
 * operations — no generic "send anything" escape hatch. Implementations MUST
 * NOT throw on delivery failure; they capture the outcome and report it so a
 * mail failure can never alter the response shape of a token-issuing endpoint
 * (anti-enumeration rule of epic 001).
 */
export type MailTransportMode = 'log' | 'smtp';

export interface MailSendResult {
  delivered: boolean;
  transport: MailTransportMode;
}

export interface MailSender {
  sendPasswordReset(
    email: string,
    token: string,
    url: string,
  ): Promise<MailSendResult>;
  sendEmailVerification(
    email: string,
    token: string,
    url: string,
  ): Promise<MailSendResult>;
}
