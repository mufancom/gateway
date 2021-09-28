# Makeflow Gateway

A configurable gateway for development and production.

## Usage

```ts
import {
  Gateway,
  createIndexFileFallbackMatchPathRegex,
} from '@makeflow/gateway';

// development

const KOA_KEYS = ['dev'];

const gateway = new Gateway({
  keys: KOA_KEYS,
  listen: {
    port: 8080,
  },
  session: {
    rolling: true,
  },
  targets: [
    {
      type: 'proxy',
      match: '/app/api',
      base: 'http://localhost:8081',
    },
    {
      type: 'proxy',
      match: '/app',
      base: 'http://localhost:8082',
    },
    {
      type: 'proxy',
      match: '/api',
      base: 'http://localhost:8061',
    },
    {
      type: 'proxy',
      match: '',
      base: 'http://localhost:8062',
    },
  ],
});

// production

const KOA_KEYS = ['some secrets'];

const gateway = new Gateway({
  keys: KOA_KEYS,
  listen: {
    port: 8080,
  },
  session: {
    rolling: true,
  },
  targets: [
    {
      type: 'proxy',
      match: '/app/api',
      base: 'http://makeflow-app-server:8081',
    },
    {
      type: 'file',
      match: createIndexFileFallbackMatchPathRegex('/app'),
      base: Path.join(__dirname, '../../static/app/index.html'),
    },
    {
      type: 'static',
      match: '/app/',
      base: Path.join(__dirname, '../../static/app'),
    },
    {
      type: 'proxy',
      match: '/api',
      base: 'http://makeflow-community-site-server:8061',
    },
    {
      type: 'file',
      match: createIndexFileFallbackMatchPathRegex(),
      base: Path.join(__dirname, '../../static/site/index.html'),
    },
    {
      type: 'static',
      match: '/',
      base: Path.join(__dirname, '../../static/site'),
    },
  ],
});

gateway.serve();
```

## License

MIT License.
