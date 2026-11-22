import type { Product } from '../domain/product';
import type { EmailSender } from '../email/EmailSender';
import type { ProductSource } from '../products/ProductSource';
import type { EnquiryInput } from './enquirySchema';

/** Thrown when an enquiry is about a product that doesn't exist (e.g. it was removed). */
export class UnknownProductError extends Error {
  constructor(productId: string) {
    super(`Unknown product ${productId}`);
    this.name = 'UnknownProductError';
  }
}

/** Handles enquiries: looks up the product and emails the sales team. */
export class EnquiryService {
  constructor(
    private readonly products: ProductSource,
    private readonly email: EmailSender,
    private readonly salesInbox: string,
  ) {}

  /**
   * The browser only sends the product ID. We look up the product's name and price
   * ourselves, so a customer can't change what the sales team sees.
   */
  async submit(enquiry: EnquiryInput): Promise<void> {
    const product = await this.products.getProduct(enquiry.productId);
    if (!product) throw new UnknownProductError(enquiry.productId);

    await this.email.send({
      to: this.salesInbox,
      replyTo: enquiry.email, // so the sales team can simply click "Reply"
      subject: `Product enquiry: ${product.title}`,
      text: composeEnquiryEmail(enquiry, product),
    });
  }
}

/** Builds the plain-text email that the sales team receives. */
export function composeEnquiryEmail(enquiry: EnquiryInput, product: Product): string {
  const price = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: product.currency,
  }).format(product.price);

  return [
    'A customer has enquired about a product.',
    '',
    `Product: ${product.title}`,
    `Product ID: ${product.id}`,
    `Price: ${price}`,
    '',
    `Name: ${enquiry.name}`,
    `Email: ${enquiry.email}`,
    `Phone: ${enquiry.phone ?? 'Not provided'}`,
    '',
    'Message:',
    enquiry.message ?? 'No message provided',
  ].join('\n');
}
