import { useState, type FormEvent } from 'react';
import { ApiError, catalogueApi } from '../api/catalogueApi';
import type { FieldErrors } from '../api/types';
import { FormField } from './FormField';

interface EnquiryFormProps {
  productId: string;
  productTitle: string;
}

/**
 * The enquiry form. The browser's own checks (required fields, email format) are just a
 * convenience; the server checks everything, and any errors it returns are shown next to
 * the matching field. On success, the form is replaced by a "Thank you" message.
 */
export function EnquiryForm({ productId, productTitle }: EnquiryFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      await catalogueApi.submitEnquiry({ productId, name, email, phone, message });
      setSubmitted(true);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        setFieldErrors(error.fields); // form errors: show each one next to its field
      } else {
        // any other problem (e.g. email could not be sent): show one message above the button
        setFormError(error instanceof ApiError ? error.message : 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="enquiry-thanks" role="status">
        <h3>Thank you</h3>
        <p>We have received your enquiry about {productTitle}. Our sales team will be in touch soon.</p>
      </div>
    );
  }

  return (
    <form className="enquiry-form" onSubmit={handleSubmit}>
      <h3>Enquire about this product</h3>

      <FormField
        label="Name"
        name="name"
        value={name}
        onChange={setName}
        error={fieldErrors.name?.[0]}
        required
        maxLength={100}
        autoComplete="name"
      />
      <FormField
        label="Email"
        name="email"
        type="email"
        value={email}
        onChange={setEmail}
        error={fieldErrors.email?.[0]}
        required
        maxLength={254}
        autoComplete="email"
      />
      <FormField
        label="Phone (optional)"
        name="phone"
        type="tel"
        value={phone}
        onChange={setPhone}
        error={fieldErrors.phone?.[0]}
        maxLength={30}
        autoComplete="tel"
      />
      <FormField
        label="Message (optional)"
        name="message"
        multiline
        value={message}
        onChange={setMessage}
        error={fieldErrors.message?.[0]}
        maxLength={2000}
      />

      {formError && (
        <p className="error" role="alert">
          {formError}
        </p>
      )}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  );
}
