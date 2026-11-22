/**
 * What every email provider must be able to do: SMTP today, for example Amazon SES later.
 * This is the swap point for email: to change provider, write a new class that follows this
 * interface and choose it in container.ts.
 */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export interface EmailMessage {
  to: string;
  replyTo?: string;
  subject: string;
  /** Plain text only, so nothing a customer types is ever shown as HTML. */
  text: string;
}

/** Thrown when an email could not be sent. */
export class EmailDeliveryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EmailDeliveryError';
  }
}
