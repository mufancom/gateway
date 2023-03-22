# Makeflow Gateway

A configurable gateway for development and production.

## Usage

```ts
import {
  Gateway,
  createIndexFileFallbackMatchPathRegex,
} from '@makeflow/gateway';

// development

const gateway = new Gateway({
  listen: {
    port: 8080,
  },
  targets: [
    {
      type: 'proxy',
      match: '/app/api',
      target: 'http://localhost:8081{path}',
    },
    {
      type: 'proxy',
      match: '/app',
      target: 'http://localhost:8082{path}',
    },
    {
      type: 'proxy',
      match: '/api',
      target: 'http://localhost:8061{path}',
    },
    {
      type: 'proxy',
      match: '',
      target: 'http://localhost:8062{path}',
    },
  ],
});

// production

const gateway = new Gateway({
  listen: {
    port: 8080,
  },
  targets: [
    {
      type: 'proxy',
      match: '/app/api',
      target: 'http://makeflow-app-server:8081{path}',
    },
    {
      type: 'file',
      match: createIndexFileFallbackMatchPathRegex('/app'),
      target: Path.join(__dirname, '../../static/app/index.html'),
    },
    {
      type: 'file',
      match: '/app',
      target: Path.join(__dirname, '../../static/app{path}'),
    },
    {
      type: 'proxy',
      match: '/api',
      target: 'http://makeflow-community-site-server:8061{path}',
    },
    {
      type: 'file',
      match: createIndexFileFallbackMatchPathRegex(),
      target: Path.join(__dirname, '../../static/site/index.html'),
    },
    {
      type: 'file',
      match: '',
      target: Path.join(__dirname, '../../static/site{path}'),
    },
  ],
});

gateway.serve();
```

## License

MIT License.
