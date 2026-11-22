import type { ChangeEvent } from 'react';

interface FormFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** The server's error message for this field, if there is one. */
  error?: string;
  type?: 'text' | 'email' | 'tel';
  multiline?: boolean;
  required?: boolean;
  maxLength: number;
  autoComplete?: string;
}

/** A label, an input (or a text area) and its error message, linked so screen readers read them together. */
export function FormField({
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
  multiline = false,
  required = false,
  maxLength,
  autoComplete,
}: FormFieldProps) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;

  const inputProps = {
    id,
    name,
    value,
    required,
    maxLength,
    autoComplete,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? <textarea rows={4} {...inputProps} /> : <input type={type} {...inputProps} />}
      {error && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}
