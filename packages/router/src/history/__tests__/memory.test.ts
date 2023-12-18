import { createMemoryHistory } from '..';

import InitialLocationHasKey from './TestSequences/InitialLocationHasKey.js';
import PushNewLocation from './TestSequences/PushNewLocation.js';
import PushSamePath from './TestSequences/PushSamePath.js';
import PushState from './TestSequences/PushState.js';
import PushMissingPathname from './TestSequences/PushMissingPathname.js';
import PushRelativePathnameWarning from './TestSequences/PushRelativePathnameWarning.js';
import ReplaceNewLocation from './TestSequences/ReplaceNewLocation.js';
import ReplaceSamePath from './TestSequences/ReplaceSamePath.js';
import ReplaceState from './TestSequences/ReplaceState.js';
import EncodedReservedCharacters from './TestSequences/EncodedReservedCharacters.js';
import GoBack from './TestSequences/GoBack.js';
import GoForward from './TestSequences/GoForward.js';
import BlockEverything from './TestSequences/BlockEverything.js';
import BlockPopWithoutListening from './TestSequences/BlockPopWithoutListening.js';
import { createRouter } from '../../router';
import { IRouter, IRouteRecord } from '../../types';

describe.each([false, true])('a memory history', hasBasename => {
  let router: IRouter;
  beforeEach(() => {
    let history = hasBasename
      ? createMemoryHistory({ basename: '/base', initialEntries: ['/base'] })
      : createMemoryHistory();
    router = createRouter({
      routes: [] as IRouteRecord[],
      history
    }).init();
  });

  it('knows how to create hrefs', () => {
    const { href } = router.resolve({
      pathname: '/the/path',
      search: '?the=query',
      hash: '#the-hash'
    });
    const expectedHref = hasBasename
      ? '/base/the/path?the=query#the-hash'
      : '/the/path?the=query#the-hash';
    expect(href).toEqual(expectedHref);
  });

  it('knows how to create hrefs from strings', () => {
    const { href } = router.resolve('/the/path?the=query#the-hash');
    const expectedHref = hasBasename
      ? '/base/the/path?the=query#the-hash'
      : '/the/path?the=query#the-hash';
    expect(href).toEqual(expectedHref);
  });

  it('does not encode the generated path', () => {
    const { href: encodedHref } = router.resolve({
      pathname: '/%23abc'
    });
    const expectedHref = hasBasename ? '/base/%23abc' : '/%23abc';
    expect(encodedHref).toEqual(expectedHref);

    const { href: unencodedHref } = router.resolve({
      pathname: '/#abc'
    });
    const expectedUnencodedHref = hasBasename ? '/base/#abc' : '/#abc';
    expect(unencodedHref).toEqual(expectedUnencodedHref);
  });

  describe('the initial location', () => {
    it('has a key', done => {
      InitialLocationHasKey(router, done);
    });
  });

  describe('push a new path', () => {
    it('calls change listeners with the new location', done => {
      PushNewLocation(router, done);
    });
  });

  describe('push the same path', () => {
    it('calls change listeners with the new location', done => {
      PushSamePath(router, done);
    });
  });

  describe('push state', () => {
    it('calls change listeners with the new location', done => {
      PushState(router, done);
    });
  });

  describe('push with no pathname', () => {
    it('reuses the current location pathname', done => {
      PushMissingPathname(router, done);
    });
  });

  describe('push with a relative pathname', () => {
    it('issues a warning', done => {
      PushRelativePathnameWarning(router, done);
    });
  });

  describe('replace a new path', () => {
    it('calls change listeners with the new location', done => {
      ReplaceNewLocation(router, done);
    });
  });

  describe('replace the same path', () => {
    it('calls change listeners with the new location', done => {
      ReplaceSamePath(router, done);
    });
  });

  describe('replace state', () => {
    it('calls change listeners with the new location', done => {
      ReplaceState(router, done);
    });
  });

  describe('location created with encoded/unencoded reserved characters', () => {
    it('produces different location objects', done => {
      EncodedReservedCharacters(router, done);
    });
  });

  describe('back', () => {
    it('calls change listeners with the previous location', done => {
      GoBack(router, done);
    });
  });

  // TODO: fix forward test
  describe('forward', () => {
    it('calls change listeners with the next location', done => {
      GoForward(router, done);
    });
  });

  describe('block', () => {
    it('blocks all transitions', done => {
      BlockEverything(router, done);
    });
  });

  describe('block a POP without listening', () => {
    it('receives the next location and action as arguments', done => {
      BlockPopWithoutListening(router, done);
    });
  });
});

describe('a memory history with some initial entries', () => {
  it('clamps the initial index to a valid value', () => {
    let history = createMemoryHistory({
      initialEntries: ['/one', '/two', '/three'],
      initialIndex: 3 // invalid
    });

    // @ts-ignore
    expect(history._index).toBe(2);
  });

  it('starts at the last entry by default', () => {
    let history = createMemoryHistory({
      initialEntries: ['/one', '/two', '/three']
    });

    // @ts-ignore
    expect(history._index).toBe(2);
    expect(history.location).toMatchObject({
      pathname: '/three',
      search: '',
      hash: '',
      state: null,
      key: expect.any(String)
    });
  });
});

describe('init with basename', () => {
  it('should redirect if initial entry does not match base', () => {
    const history = createMemoryHistory({
      basename: '/base',
      initialEntries: ['/does-not-match-base']
    });
    const router = createRouter({
      routes: [],
      history
    }).init();

    let current = router.current;

    // memoryHistory will not directly redirect, but it will set notMatchBasename to true
    expect(history.location.notMatchBasename).toBe(true);
    expect(current.redirected).toBe(true);
    expect(current.pathname).toBe('/does-not-match-base');
  });
});
