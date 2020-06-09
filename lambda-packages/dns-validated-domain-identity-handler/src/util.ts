export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitFor<State>(
  poller: () => Promise<State>,
  tester: (state: State) => boolean,
  options: {
    maxAttempts: number;
    delay: number;
    failureMessage?: string;
  },
): Promise<State> {
  const { maxAttempts } = options;
  const delayInMs = options.delay * 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const state = await poller();

      if (tester(state)) {
        return state;
      }
    } catch (e) {
      // Swallow errors and continue to next attempt
    }

    await sleep(delayInMs * (attempt ** 2));
  }

  throw new Error(options.failureMessage ?? "Maximum attempts exceeded");
}
