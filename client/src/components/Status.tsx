/** Shown while data is loading. */
export function Loading() {
  return (
    <p className="muted" role="status">
      Loading…
    </p>
  );
}

/** Shown when something goes wrong. role="alert" makes screen readers announce it. */
export function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="error" role="alert">
      {message}
    </p>
  );
}
