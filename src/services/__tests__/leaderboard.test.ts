import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@series-inc/rundot-game-sdk/api', () => import('../__mocks__/rundot-game-sdk'));

import RundotGameAPI, { resetRundotMock } from '../__mocks__/rundot-game-sdk';
import {
  submitScore,
  resetSubmitThrottle,
  getTopN,
  getPodiumWithContext,
  getMyRank,
  KitLeaderboardError,
} from '../leaderboard';

beforeEach(() => {
  resetRundotMock();
  resetSubmitThrottle();
});

describe('submitScore', () => {
  it('submits in Simple mode (no token, duration 0) and returns accepted', async () => {
    RundotGameAPI.leaderboard.submitScore.mockResolvedValueOnce({ accepted: true, rank: 3 });
    expect(await submitScore(7)).toBe(true);
    expect(RundotGameAPI.leaderboard.submitScore).toHaveBeenCalledWith({ score: 7, duration: 0 });
  });

  it('retries once on failure then succeeds', async () => {
    RundotGameAPI.leaderboard.submitScore
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValueOnce({ accepted: true });
    expect(await submitScore(2)).toBe(true);
    expect(RundotGameAPI.leaderboard.submitScore).toHaveBeenCalledTimes(2);
  });

  it('logs leaderboard_submit_failed and returns false after two failures (never blocks the game)', async () => {
    RundotGameAPI.leaderboard.submitScore.mockRejectedValue(new Error('down'));
    expect(await submitScore(2)).toBe(false);
    expect(RundotGameAPI.analytics.recordCustomEvent).toHaveBeenCalledWith(
      'leaderboard_submit_failed',
      undefined,
    );
  });

  it('throttles a second submit inside the 60s window (one network call)', async () => {
    RundotGameAPI.leaderboard.submitScore.mockResolvedValue({ accepted: true, rank: 1 });
    expect(await submitScore(10)).toBe(true);
    expect(await submitScore(11)).toBe(false);
    expect(RundotGameAPI.leaderboard.submitScore).toHaveBeenCalledTimes(1);
  });

  it('treats a rate-limit rejection as a benign skip: no retry, no failure event', async () => {
    RundotGameAPI.leaderboard.submitScore.mockRejectedValueOnce(new Error('Rate limit exceeded'));
    expect(await submitScore(5)).toBe(false);
    expect(RundotGameAPI.leaderboard.submitScore).toHaveBeenCalledTimes(1);
    expect(RundotGameAPI.analytics.recordCustomEvent).not.toHaveBeenCalledWith(
      'leaderboard_submit_failed',
      undefined,
    );
  });
});

describe('queries', () => {
  it('getTopN maps SDK entries to kit entries', async () => {
    RundotGameAPI.leaderboard.getPagedScores.mockResolvedValueOnce({
      variant: 'standard',
      entries: [
        { profileId: 'p1', username: 'Ava', avatarUrl: null, score: 99, rank: 1, isSeed: true },
      ],
      totalEntries: 1,
      playerRank: 1,
      periodInstance: 'alltime',
    });
    const top = await getTopN(10);
    expect(top).toEqual([
      { profileId: 'p1', username: 'Ava', avatarUrl: null, score: 99, rank: 1, isSeed: true },
    ]);
    expect(RundotGameAPI.leaderboard.getPagedScores).toHaveBeenCalledWith({ limit: 10 });
  });

  it('getTopN throws KitLeaderboardError on query failure', async () => {
    RundotGameAPI.leaderboard.getPagedScores.mockRejectedValueOnce(new Error('x'));
    await expect(getTopN(10)).rejects.toBeInstanceOf(KitLeaderboardError);
  });

  it('getPodiumWithContext shapes the podium', async () => {
    RundotGameAPI.leaderboard.getPodiumScores.mockResolvedValueOnce({
      variant: 'highlight',
      entries: [],
      totalEntries: 0,
      playerRank: 5,
      periodInstance: 'alltime',
      context: {
        topEntries: [{ profileId: 't', username: 'Top', avatarUrl: null, score: 100, rank: 1 }],
        beforePlayer: [],
        playerEntry: { profileId: 'me', username: 'Me', avatarUrl: null, score: 40, rank: 5 },
        afterPlayer: [],
        totalBefore: 4,
        totalAfter: 0,
        omittedBefore: 0,
        omittedAfter: 0,
      },
    });
    const podium = await getPodiumWithContext(3, 4, 2);
    expect(podium.top[0]?.username).toBe('Top');
    expect(podium.player?.username).toBe('Me');
  });

  it('getMyRank returns the rank number', async () => {
    RundotGameAPI.leaderboard.getMyRank.mockResolvedValueOnce({
      rank: 12,
      totalPlayers: 100,
      trustScore: 100,
      periodInstance: 'alltime',
    });
    expect(await getMyRank()).toBe(12);
  });

  it('getMyRank throws KitLeaderboardError on failure', async () => {
    RundotGameAPI.leaderboard.getMyRank.mockRejectedValueOnce(new Error('x'));
    await expect(getMyRank()).rejects.toBeInstanceOf(KitLeaderboardError);
  });
});
