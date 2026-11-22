import { z } from 'zod';

/** An optional text field. Spaces are trimmed, and empty text counts as "not provided". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

/**
 * Rules for checking an enquiry form submission. Each message here is shown to the
 * customer next to the matching form field.
 */
export const enquirySchema = z.object({
  productId: z.string().trim().min(1, 'Product is required').max(64),
  name: z.string().trim().min(1, 'Name is required').max(100),
  // Trim spaces first, then check it's a valid email address
  email: z.string().trim().max(254).pipe(z.email('Enter a valid email address')),
  phone: optionalText(30).refine(
    // Digits, spaces, "+", "-" and brackets only; 6 to 30 characters
    (value) => value === undefined || /^[0-9+()\-\s]{6,30}$/.test(value),
    'Enter a valid phone number',
  ),
  message: optionalText(2000),
});

/** A checked enquiry (this TypeScript type is created from the rules above). */
export type EnquiryInput = z.infer<typeof enquirySchema>;
