import { CatalogueService } from './catalogue/CatalogueService';
import type { Config } from './config';
import type { EmailSender } from './email/EmailSender';
import { SmtpEmailSender } from './email/SmtpEmailSender';
import { EnquiryService } from './enquiry/EnquiryService';
import { FakeStoreProductSource } from './products/FakeStoreProductSource';
import type { ProductSource } from './products/ProductSource';

/**
 * The one place where we choose which product source and which email sender the app uses.
 * To switch to a different provider, change it here. The rest of the app doesn't need to change.
 */
export function createServices(config: Config) {
  const products: ProductSource = new FakeStoreProductSource(config.FAKESTORE_BASE_URL);

  const emailSender: EmailSender = new SmtpEmailSender({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    user: config.SMTP_USER,
    password: config.SMTP_PASSWORD,
    from: config.EMAIL_FROM,
  });

  const catalogue = new CatalogueService(products, config.FEATURED_PRODUCT_IDS);
  const enquiries = new EnquiryService(products, emailSender, config.SALES_INBOX_EMAIL);

  return { catalogue, enquiries };
}
