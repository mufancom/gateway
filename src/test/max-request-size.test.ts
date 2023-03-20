import {Server} from 'http';
import type {AddressInfo} from 'net';
import {PassThrough} from 'stream';

import Koa from 'koa';
import fetch from 'node-fetch';

import {Gateway} from '../library';

let gatewayURL!: string;

beforeAll(async () => {
  const targetKoa = new Koa();

  targetKoa.use(context => {
    context.body = 'ok';
  });

  const targetServer = new Server(targetKoa.callback());

  targetServer.listen();

  const targetKoaURL = `http://localhost:${
    (targetServer.address() as AddressInfo).port
  }`;

  const gateway = new Gateway({
    listen: {
      port: 0,
    },
    targets: [
      {
        type: 'proxy',
        target: targetKoaURL,
        options: {
          maxRequestSize: 1024,
          responseHeadersFallback: {
            'x-fallback': 'fallback-header',
          },
        },
      },
    ],
  });

  const gatewayServer = gateway.serve();

  gatewayURL = `http://localhost:${
    (gatewayServer.address() as AddressInfo).port
  }`;
});

test('should 200 for fixed length content', async () => {
  const response = await fetch(gatewayURL, {
    method: 'POST',
    body: Buffer.alloc(10),
  });

  expect(response.status).toEqual(200);
  expect(await response.text()).toEqual('ok');
});

test('should 413 for fixed length content', async () => {
  const response = await fetch(gatewayURL, {
    method: 'POST',
    body: Buffer.alloc(2048),
  });

  expect(response.status).toEqual(413);
  expect(response.headers.get('x-fallback')).toEqual('fallback-header');
  expect(await response.text()).toEqual('');
});

test('should 200 for stream', async () => {
  const stream = new PassThrough();

  stream.write(Buffer.alloc(10));

  const response = await fetch(gatewayURL, {
    method: 'POST',
    body: stream,
  });

  expect(response.status).toEqual(200);
  expect(await response.text()).toEqual('ok');
});

test('should 413 for stream', async () => {
  const stream = new PassThrough();

  stream.write(Buffer.alloc(2048));

  const response = await fetch(gatewayURL, {
    method: 'POST',
    body: stream,
  });

  expect(response.status).toEqual(413);
  expect(response.headers.get('x-fallback')).toEqual('fallback-header');
  expect(await response.text()).toEqual('');
});
