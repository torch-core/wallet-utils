import { beginCell, Cell, external, storeMessage } from '@ton/core';

export const getMessageHash = (dest: string, body: Cell) => {
  const externalMsg = beginCell()
    .store(
      storeMessage(
        external({
          to: dest,
          body,
        }),
      ),
    )
    .endCell();

  return externalMsg.hash().toString('hex');
};

type AsyncLambda<T> = () => Promise<T>;
type DummyFunction = (error?: unknown) => { ok: boolean; value: unknown };

type RetryParams = {
  attempts?: number;
  attemptInterval?: number;
  verbose?: boolean;
  on_fail?: DummyFunction | ((error: unknown) => void);
};

const DUMMY_FUNCTION_INSTANCE: DummyFunction = () => ({
  ok: false,
  value: null,
});

const DEFAULT_RETRY_PARAMS: Required<RetryParams> = {
  attempts: 3,
  attemptInterval: 3000,
  verbose: false,
  on_fail: DUMMY_FUNCTION_INSTANCE,
};

// Conditional return type based on success or failure
type RetryResult<T> = { ok: true; value: T } | { ok: false; value: null; error: unknown };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tries to run specified lambda several times if it throws, passing the last error to on_fail
 * @type T - Type of the return value
 * @param lambda - Lambda function to execute
 * @param params - Retry parameters: attempts, attemptInterval, verbose, on_fail
 * @returns Result object with `ok` indicating success and `value` holding the return value or `error` holding the last encountered error
 */
export async function retry<T>(lambda: AsyncLambda<T>, params: RetryParams = {}): Promise<RetryResult<T>> {
  const { attempts, attemptInterval, verbose, on_fail } = {
    ...DEFAULT_RETRY_PARAMS,
    ...params,
  };

  let value: T | null = null;
  let ok = false;
  let lastError: unknown = null;

  for (let n = attempts; n > 0; n--) {
    try {
      value = await lambda();
      ok = true;
      break; // Exit loop on success
    } catch (error: unknown) {
      lastError = error;

      if (typeof on_fail === 'function') {
        on_fail(error);
      }

      if (verbose) {
        console.error(`Attempt ${attempts - n + 1} failed`);
        console.error(`Retries left: ${n - 1}\n`);
      }

      if (n > 1) await sleep(attemptInterval); // Avoid sleeping after the last attempt
    }
  }

  if (ok) {
    return { ok, value: value as T }; // `value` is guaranteed to be `T` if `ok` is true
  } else {
    return { ok, value: null, error: lastError }; // Return only the last error
  }
}
