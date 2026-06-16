import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@series-inc/rundot-game-sdk/api', () => import('../__mocks__/rundot-game-sdk'));

import RundotGameAPI, { resetRundotMock } from '../__mocks__/rundot-game-sdk';
import { shareMoment, createShareQRCode, KIT_SHARE_KEY } from '../sharing';

const input = {
  title: 'Come see my cottage',
  description: 'Day 12',
  params: { room: 'garden', day: 12 },
};

beforeEach(() => {
  resetRundotMock();
});

describe('shareMoment', () => {
  it('kit-stamps + stringifies params, builds metadata, and returns the share URL', async () => {
    const url = await shareMoment(input);
    expect(url).toBe('https://run.game/s/abc');
    expect(RundotGameAPI.social.shareLinkAsync).toHaveBeenCalledWith({
      shareParams: {
        kit: KIT_SHARE_KEY,
        room: 'garden',
        day: '12',
      },
      metadata: {
        title: 'Come see my cottage',
        description: 'Day 12',
      },
    });
  });

  it('includes the share image when provided', async () => {
    await shareMoment({ ...input, imageUrl: 'https://cdn/x.png' });
    const call = RundotGameAPI.social.shareLinkAsync.mock.calls[0]?.[0];
    expect(call?.metadata?.imageUrl).toBe('https://cdn/x.png');
  });

  it('returns null and does not throw when the share fails (best-effort)', async () => {
    RundotGameAPI.social.shareLinkAsync.mockRejectedValueOnce(new Error('no share sheet'));
    await expect(shareMoment(input)).resolves.toBeNull();
  });
});

describe('createShareQRCode', () => {
  it('returns the QR data and share URL', async () => {
    const qr = await createShareQRCode(input);
    expect(qr).toEqual({ qrCode: 'data:image/png;base64,AAAA', shareUrl: 'https://run.game/s/abc' });
  });

  it('returns null on failure', async () => {
    RundotGameAPI.social.createQRCodeAsync.mockRejectedValueOnce(new Error('x'));
    await expect(createShareQRCode(input)).resolves.toBeNull();
  });
});
