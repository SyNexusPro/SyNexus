export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

export const REQUEST_TIMEOUT_MESSAGE = "The request timed out. Please try again.";

/**
 * Rejects when the network call has not settled in time so a stalled request can
 * never leave a submit button spinning forever.
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms = AUTH_REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(REQUEST_TIMEOUT_MESSAGE)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
