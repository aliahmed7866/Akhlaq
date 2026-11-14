import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setupMediaSession } from '../public/media-session.js';

test('phone controls reflect verse boundaries, playback state and the current translation', () => {
  const handlers = {};
  let position;
  const session = { setActionHandler: (key, action) => { handlers[key] = action; },
    setPositionState: value => { position = value; } };
  const calls = [];
  const actions = Object.fromEntries(['play', 'pause', 'stop', 'next', 'previous'].map(key => [key, () => calls.push(key)]));
  const audio = { duration: 24, currentTime: 9, playbackRate: 1.25 };
  const media = setupMediaSession({ session, Metadata: class { constructor(value) { Object.assign(this, value); } }, audio, actions });
  media.update({ title: 'Al-Fatiha 1:1', artist: '1 of 2 · Arabic recitation', state: 'playing', previous: false, next: true });
  assert.equal(session.playbackState, 'playing');
  assert.equal(session.metadata.title, 'Al-Fatiha 1:1');
  assert.equal(handlers.previoustrack, null);
  handlers.pause(); handlers.play(); handlers.nexttrack();
  assert.deepEqual(calls, ['pause', 'play', 'next']);
  handlers.seekto({ seekTime: 99 });
  assert.equal(audio.currentTime, 24);
  handlers.seekbackward({ seekOffset: 40 });
  assert.equal(audio.currentTime, 0);
  handlers.seekforward({});
  assert.equal(audio.currentTime, 10);
  assert.deepEqual(position, { duration: 24, playbackRate: 1.25, position: 10 });
  media.update({ title: 'Al-Fatiha 1:7', artist: '2 of 2 · Urdu translation', state: 'paused', previous: true, next: false });
  assert.equal(session.metadata.artist, '2 of 2 · Urdu translation');
  assert.equal(handlers.nexttrack, null);
  handlers.previoustrack(); handlers.stop();
  assert.deepEqual(calls.slice(-2), ['previous', 'stop']);
  media.clear();
  assert.equal(session.metadata, null);
  assert.equal(session.playbackState, 'none');
  assert.ok(Object.values(handlers).every(action => action === null));
  assert.equal(position, undefined);
});

test('unknown durations and unsupported media-session methods are safe', () => {
  for (const session of [undefined, { setActionHandler() { throw new Error('unsupported'); }, setPositionState() { throw new Error('unsupported'); } }]) {
    const media = setupMediaSession({ session, audio: { duration: NaN }, actions: {} });
    assert.doesNotThrow(() => { media.update({ state: 'paused' }); media.position(); media.resetPosition(); media.clear(); });
  }
});
