import { createContext } from 'react';
import type { SessionConfig } from './core/types';

export const ConfigContext = createContext<SessionConfig | null>(null);
