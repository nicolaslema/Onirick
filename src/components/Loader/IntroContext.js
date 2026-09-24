import { createContext, useContext } from 'react';

// true once the loader starts lifting — the hero's cue for its entrance.
export const IntroContext = createContext(true);

export const useIntroStarted = () => useContext(IntroContext);
