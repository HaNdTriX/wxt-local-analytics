import { defineAnalyticsProvider } from "@wxt-dev/analytics";
import type {
  AnalyticsPageViewEvent,
  AnalyticsTrackEvent,
  BaseAnalyticsEvent,
} from "@wxt-dev/analytics/types";

type LocalAnalyticsOptions = {
  /** The name for the indexDB db */
  dbName?: string;
  /** The version of the db */
  dbVersion?: number;
};

type LocalAnalyticsEvent =
  | { type: "identify"; event: BaseAnalyticsEvent }
  | { type: "page"; event: AnalyticsPageViewEvent }
  | { type: "track"; event: AnalyticsTrackEvent };

let dbPromise: Promise<IDBDatabase> | null = null;

export default defineAnalyticsProvider<LocalAnalyticsOptions>(
  (_, _analyticsConfig, providerConfig) => {
    const { dbName = "analytics", dbVersion = 1 } = providerConfig;

    function getAnalyticsDb(): Promise<IDBDatabase> {
      if (dbPromise) return dbPromise;

      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onerror = () => {
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains("events")) {
            db.createObjectStore("events", {
              keyPath: "id",
              autoIncrement: true,
            });
          }
        };
      });

      return dbPromise;
    }

    async function sendToIDBLog(event: LocalAnalyticsEvent) {
      const db = await getAnalyticsDb();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("events", "readwrite");
        const store = transaction.objectStore("events");
        const request = store.add(event);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    }

    return {
      identify: async () => {},
      page: async (event) => {
        await sendToIDBLog({ type: "page", event });
      },
      track: async (event) => {
        await sendToIDBLog({ type: "track", event });
      },
    };
  },
);
