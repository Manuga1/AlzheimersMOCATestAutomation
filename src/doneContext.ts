import { createContext } from 'react';

/**
 * Lets an item replace the generic "Done — move on" behavior with its own
 * finisher that scores partial work (e.g. trail scores the taps made so far
 * instead of recording a bare early exit).
 */
export interface DoneRegistry {
  register: (fn: () => void) => void;
}

export const DoneContext = createContext<DoneRegistry | null>(null);
