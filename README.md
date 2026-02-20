# wxt-local-analytics

A local analytics provider for [`@wxt-dev/analytics`](https://www.npmjs.com/package/@wxt-dev/analytics) that persists events to **IndexedDB** in the browser.

## What it does

- Implements a WXT analytics provider using `defineAnalyticsProvider`
- Stores `page` and `track` events locally in IndexedDB
- Supports configurable IndexedDB database name and version
- Uses the [`idb`](https://www.npmjs.com/package/idb) wrapper for IndexedDB access

Current storage details:

- Database name: `analytics` (default)
- Version: `1`
- Object store: `events`

Provider options:

- `dbName: string` — IndexedDB database name
- `dbVersion: number` — IndexedDB database version

## Installation

```bash
pnpm add wxt-local-analytics @wxt-dev/analytics
```

> `@wxt-dev/analytics` is a peer dependency.

## Usage

```ts
import { createAnalytics } from "@wxt-dev/analytics";
import localAnalyticsProvider from "wxt-local-analytics";

const analytics = createAnalytics({
  provider: localAnalyticsProvider,
  providerConfig: {
    dbName: "my-extension-analytics",
    dbVersion: 1,
  },
});

await analytics.page({
  name: "Home",
  path: "/",
});

await analytics.track({
  name: "Button Clicked",
  properties: { section: "hero" },
});
```

## Development

```bash
pnpm install
pnpm build
pnpm dev
```

## Notes

- `identify` is currently a no-op in this provider.
- This package is intended for browser contexts where IndexedDB is available.
