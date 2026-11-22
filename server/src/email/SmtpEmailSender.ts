import nodemailer, { type Transporter } from 'nodemailer';
import { EmailDeliveryError, type EmailMessage, type EmailSender } from './EmailSender';

/** Where to send email from, and how to connect to the SMTP server. */
export interface SmtpOptions {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
}

/**
 * Sends email through any SMTP server: Mailpit locally (no account needed), or a real
 * provider such as Amazon SES just by changing the settings.
 */
export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;

  constructor(private readonly options: SmtpOptions) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      // Port 465 uses an encrypted connection from the start. Other ports (e.g. 587)
      // switch to encryption if the server supports it.
      secure: options.port === 465,
      auth: options.user ? { user: options.user, pass: options.password } : undefined,
      connectionTimeout: 10_000, // give up after 10 seconds
    });
  }

  /** Sends the email. If it fails, throws EmailDeliveryError so the user gets a clear message. */
  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.options.from, ...message });
    } catch (error) {
      throw new EmailDeliveryError('Failed to send email via SMTP', { cause: error });
    }
  }
}
