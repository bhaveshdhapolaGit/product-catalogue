import { useEffect, useState, type DependencyList } from 'react';
import { ApiError } from '../api/catalogueApi';

/** The three states of loading data: still loading, loaded, or failed. */
export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: ApiError };

/**
 * Loads data and tracks whether it's loading, loaded or failed.
 * It loads again whenever `deps` change (e.g. a new search term), and ignores a slow,
 * out-of-date answer if the user has already moved on.
 */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

  useEffect(() => {
    let active = true; // becomes false when deps change or the page closes
    setState({ status: 'loading' });
    load().then(
      (data) => active && setState({ status: 'success', data }),
      (error: unknown) =>
        active &&
        setState({
          status: 'error',
          error: error instanceof ApiError ? error : new ApiError(0, 'Something went wrong'),
        }),
    );
    return () => {
      active = false;
    };
    // The caller lists what the data depends on (deps), e.g. [searchTerm].
  }, deps);

  return state;
}
