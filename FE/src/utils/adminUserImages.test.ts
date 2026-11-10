import { describe, expect, it } from 'vitest';
import { applyUserImage, mergeSavedUser, userImageKey, usersAwaitingImages } from './adminUserImages';

const row = (over: Record<string, any> = {}) => ({
  _id: 'u1',
  email: 'ann@x.com',
  username: 'Ann',
  image: 'IMG_2921.JPG',
  ...over,
});

describe('userImageKey', () => {
  it('prefers the id', () => {
    expect(userImageKey(row())).toBe('u1');
  });

  it('falls back to the email when there is no id', () => {
    expect(userImageKey(row({ _id: undefined }))).toBe('ann@x.com');
  });

  it('is empty when the row can be identified by neither', () => {
    expect(userImageKey({ username: 'Ann' } as any)).toBe('');
    expect(userImageKey(null)).toBe('');
    expect(userImageKey(undefined)).toBe('');
  });
});

describe('usersAwaitingImages', () => {
  it('drops an unresolved filename so the avatar falls back to initials', () => {
    const [first] = usersAwaitingImages([row()]);
    expect(first.image).toBeNull();
  });

  it('keeps every other field exactly as it was', () => {
    const [first] = usersAwaitingImages([row()]);
    expect(first).toMatchObject({ _id: 'u1', email: 'ann@x.com', username: 'Ann' });
  });

  it('does not copy a row that has no image to clear', () => {
    const untouched = row({ image: undefined });
    const [first] = usersAwaitingImages([untouched]);
    expect(first).toBe(untouched);
  });

  it('survives a missing list', () => {
    expect(usersAwaitingImages(null)).toEqual([]);
    expect(usersAwaitingImages(undefined)).toEqual([]);
    expect(usersAwaitingImages([])).toEqual([]);
  });
});

describe('applyUserImage', () => {
  const users = [row(), row({ _id: 'u2', email: 'bob@x.com', username: 'Bob' })];

  it('puts the photo on the row it belongs to', () => {
    const next = applyUserImage(users, 'u2', 'data:image/png;base64,AAA');
    expect(next[1].image).toBe('data:image/png;base64,AAA');
  });

  it('leaves every other row alone', () => {
    const next = applyUserImage(users, 'u2', 'data:image/png;base64,AAA');
    expect(next[0]).toBe(users[0]);
  });

  it('matches by email when the row has no id', () => {
    const list = [row({ _id: undefined })];
    const next = applyUserImage(list, 'ann@x.com', 'data:image/png;base64,BBB');
    expect(next[0].image).toBe('data:image/png;base64,BBB');
  });

  it('returns the same list when nothing matches, so no pointless re-render happens', () => {
    expect(applyUserImage(users, 'nobody', 'data:image/png;base64,AAA')).toBe(users);
  });

  it('ignores a blank key or a photo that failed to resolve', () => {
    expect(applyUserImage(users, '', 'data:image/png;base64,AAA')).toBe(users);
    expect(applyUserImage(users, 'u1', null)).toBe(users);
    expect(applyUserImage(users, 'u1', undefined)).toBe(users);
  });

  it('survives a missing list', () => {
    expect(applyUserImage(null, 'u1', 'x')).toEqual([]);
    expect(applyUserImage(undefined, 'u1', 'x')).toEqual([]);
  });

  it('does not mutate the list it was given', () => {
    const before = JSON.stringify(users);
    applyUserImage(users, 'u1', 'data:image/png;base64,CCC');
    expect(JSON.stringify(users)).toBe(before);
  });
});

describe('mergeSavedUser', () => {
  const PHOTO = 'data:image/png;base64,AAAA';

  it('keeps the photo already on screen instead of the saved filename', () => {
    const [first] = mergeSavedUser([row({ image: PHOTO })], row({ status: 'blocked' }));
    expect(first.image).toBe(PHOTO);
    expect((first as any).status).toBe('blocked');
  });

  it('keeps initials when the photo has not loaded yet, rather than the raw filename', () => {
    const [first] = mergeSavedUser([row({ image: null })], row({ status: 'review' }));
    expect(first.image).toBeNull();
  });

  it('keeps the sign-in lock, which the saved profile does not carry', () => {
    const lock = { lockedUntil: '2026-11-10' };
    const [first] = mergeSavedUser([row({ loginLock: lock })], row({ status: 'active' }) as any);
    expect((first as any).loginLock).toBe(lock);
  });

  it('takes every other field from the saved profile', () => {
    const [first] = mergeSavedUser([row({ username: 'Old' })], row({ username: 'New', status: 'blocked' }));
    expect(first.username).toBe('New');
  });

  it('leaves other rows untouched', () => {
    const other = row({ _id: 'u2', email: 'bob@x.com', image: PHOTO });
    const out = mergeSavedUser([row(), other], row({ status: 'blocked' }));
    expect(out[1]).toBe(other);
  });

  it('returns the list unchanged when the saved user is not on screen', () => {
    const list = [row()];
    expect(mergeSavedUser(list, row({ email: 'zed@x.com' }))).toBe(list);
  });

  it('copes with a missing list or saved user', () => {
    const list = [row()];
    expect(mergeSavedUser(null, row())).toEqual([]);
    expect(mergeSavedUser(list, null)).toBe(list);
    expect(mergeSavedUser(list, { username: 'x' } as any)).toBe(list);
  });
});
