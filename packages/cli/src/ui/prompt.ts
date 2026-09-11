import { createInterface } from 'node:readline/promises';

/** Prompts the user with a yes/no question on stdin/stdout. */
export async function confirm(question: string, defaultValue = false): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const suffix = defaultValue ? 'Y/n' : 'y/N';
    const answer = (await rl.question(`${question} [${suffix}] `)).trim().toLowerCase();
    if (!answer) return defaultValue;
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}
