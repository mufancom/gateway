import {Server} from 'http';
import {AddressInfo} from 'net';
import * as Path from 'path';

import Koa from 'koa';
import Session from 'koa-session';
import fetch from 'node-fetch';

import {Gateway, createIndexFileFallbackMatchPathRegex} from '../library';

const KOA_KEYS = ['some secrets'];

let gatewayURL!: string;

beforeAll(async () => {
  const targetKoa = new Koa();

  targetKoa.keys = KOA_KEYS;

  targetKoa.use(Session(targetKoa));

  targetKoa.use(context => {
    if (context.path === '/test/set-cookie') {
      context.cookies.set('foo', 'bar');
    }

    context.body = {
      cookies: (context.request.headers['cookie'] as string)
        .split('; ')
        .map(text => text.match(/[^=]+/)![0]),
      session: {
        prevHash: !!context.session!._sessCtx.prevHash,
        populated: context.session!.populated,
      },
      url: context.url,
    };
  });

  const targetServer = new Server(targetKoa.callback());

  targetServer.listen();

  const targetKoaURL = `http://localhost:${
    (targetServer.address() as AddressInfo).port
  }`;

  const gateway = new Gateway({
    keys: KOA_KEYS,
    listen: {
      port: 0,
    },
    session: {
      rolling: true,
    },
    targets: [
      {
        type: 'proxy',
        match: '/api/',
        target: `${targetKoaURL}/test/`,
      },
      {
        type: 'file',
        match: createIndexFileFallbackMatchPathRegex(),
        target: Path.join(__dirname, '../../test/static/index.html'),
        send: {
          root: '/',
        },
      },
      {
        type: 'static',
        match: {
          path: '/',
          headers: {
            'user-agent': /Googlebot/,
          },
        },
        target: Path.join(__dirname, '../../test/static-googlebot'),
      },
      {
        type: 'static',
        match: {
          path: '/',
        },
        target: Path.join(__dirname, '../../test/static'),
      },
    ],
  });

  const gatewayServer = gateway.serve();

  gatewayURL = `http://localhost:${
    (gatewayServer.address() as AddressInfo).port
  }`;
});

test('should access static index file and have session cookie set', async () => {
  let response = await fetch(`${gatewayURL}/login`);

  let setCookieHeader = response.headers.get('set-cookie');

  expect(setCookieHeader).toMatch('koa.sess=');
  expect(setCookieHeader).toMatch('koa.sess.sig=');

  let content = await response.text();

  expect(content).toMatchInlineSnapshot(`
    "index html content
    "
  `);
});

test('should access static file and have session cookie set', async () => {
  let response = await fetch(`${gatewayURL}/foo.txt`);

  let setCookieHeader = response.headers.get('set-cookie');

  expect(setCookieHeader).toBeFalsy();

  let content = await response.text();

  expect(content).toMatchInlineSnapshot(`
    "foo text content
    "
  `);
});

test('should access googlebot static file and have session cookie set', async () => {
  let response = await fetch(`${gatewayURL}/foo.txt`, {
    headers: {
      'user-agent': 'Googlebot/1.0',
    },
  });

  let setCookieHeader = response.headers.get('set-cookie');

  expect(setCookieHeader).toBeFalsy();

  let content = await response.text();

  expect(content).toMatchInlineSnapshot(`
    "googlebot foo text content
    "
  `);
});

test('should access api and get session cookie set', async () => {
  let response = await fetch(`${gatewayURL}/api/echo?foo=bar`);

  let setCookieHeader = response.headers.get('set-cookie');

  expect(setCookieHeader).toMatch('koa.sess=');
  expect(setCookieHeader).toMatch('koa.sess.sig=');

  let result = await response.json();

  expect(result).toMatchInlineSnapshot(`
    Object {
      "cookies": Array [
        "koa.sess",
        "koa.sess.sig",
      ],
      "session": Object {
        "populated": false,
        "prevHash": true,
      },
      "url": "/test/echo?foo=bar",
    }
  `);
});

test('should access api and have additional cookie set', async () => {
  let response = await fetch(`${gatewayURL}/api/set-cookie`);

  let setCookieHeader = response.headers.get('set-cookie');

  expect(setCookieHeader).toMatch('koa.sess=');
  expect(setCookieHeader).toMatch('koa.sess.sig=');
  expect(setCookieHeader).toMatch('foo=bar');

  let result = await response.json();

  expect(result).toMatchInlineSnapshot(`
    Object {
      "cookies": Array [
        "koa.sess",
        "koa.sess.sig",
      ],
      "session": Object {
        "populated": false,
        "prevHash": true,
      },
      "url": "/test/set-cookie",
    }
  `);
});
