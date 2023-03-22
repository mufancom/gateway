import {Server} from 'http';
import type {AddressInfo} from 'net';
import * as Path from 'path';

import Express from 'express';
import fetch from 'node-fetch';

import {Gateway, createIndexFileFallbackMatchPathRegex} from '../library';

let gatewayURL!: string;

beforeAll(async () => {
  const targetApp = Express();

  targetApp.use((request, response) => {
    response.json({
      url: request.url,
    });
  });

  const targetServer = new Server(targetApp);

  targetServer.listen();

  const targetURL = `http://localhost:${
    (targetServer.address() as AddressInfo).port
  }`;

  const gateway = new Gateway({
    listen: {
      port: 0,
    },
    targets: [
      {
        type: 'proxy',
        match: '/api/',
        target: `${targetURL}/test/{path}`,
      },
      {
        type: 'file',
        match: createIndexFileFallbackMatchPathRegex(),
        target: Path.join(__dirname, '../../test/static/index.html'),
      },
      {
        type: 'file',
        match: {
          path: '/',
          headers: {
            'user-agent': /Googlebot/,
          },
        },
        target: Path.join(__dirname, '../../test/static-googlebot/{path}'),
      },
      {
        type: 'file',
        match: {
          path: '/',
        },
        target: Path.join(__dirname, '../../test/static/{path}'),
      },
    ],
  });

  const gatewayServer = gateway.serve();

  gatewayURL = `http://localhost:${
    (gatewayServer.address() as AddressInfo).port
  }`;
});

test('should access static index file', async () => {
  const response = await fetch(`${gatewayURL}/login`);

  const content = await response.text();

  expect(content).toMatchInlineSnapshot(`
    "index html content
    "
  `);
});

test('should access static file', async () => {
  const response = await fetch(`${gatewayURL}/foo.txt`);

  const content = await response.text();

  expect(content).toMatchInlineSnapshot(`
    "foo text content
    "
  `);
});

test('should access googlebot static file', async () => {
  const response = await fetch(`${gatewayURL}/foo.txt`, {
    headers: {
      'user-agent': 'Googlebot/1.0',
    },
  });

  const content = await response.text();

  expect(content).toMatchInlineSnapshot(`
    "googlebot foo text content
    "
  `);
});

test('should access api', async () => {
  const response = await fetch(`${gatewayURL}/api/echo?foo=bar`);

  const result = await response.json();

  expect(result).toMatchInlineSnapshot(`
    Object {
      "url": "/test/echo?foo=bar",
    }
  `);
});
