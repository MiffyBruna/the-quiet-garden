/**
 * Credits Storage Service
 * Manages persistent storage of player credits (names added after game completion)
 */

export interface Credit {
  name: string;
  date: string; // ISO date string
}

const STORAGE_KEY = 'quiet_garden_credits';

/**
 * Load all credits from localStorage
 */
export function loadCredits(): Credit[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load credits:', error);
    return [];
  }
}

/**
 * Add a new credit and save to localStorage
 */
export function addCredit(name: string): Credit {
  const credit: Credit = {
    name,
    date: new Date().toISOString(),
  };

  try {
    const existing = loadCredits();
    const updated = [...existing, credit];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save credit:', error);
  }

  return credit;
}

/**
 * Get only recent credits (added in the last 7 days)
 */
export function getRecentCredits(days: number = 7): Credit[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return loadCredits().filter((credit) => {
    const creditDate = new Date(credit.date);
    return creditDate >= cutoff;
  });
}

/**
 * Clear all credits (for testing/dev)
 */
export function clearCredits(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear credits:', error);
  }
}
