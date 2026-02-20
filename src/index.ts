import { defineAnalyticsProvider } from "@wxt-dev/analytics";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
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

interface AnalyticsDB extends DBSchema {
  events: {
    key: number;
    value: LocalAnalyticsEvent;
  };
}

let dbPromise: Promise<IDBPDatabase<AnalyticsDB>> | null = null;

export default defineAnalyticsProvider<LocalAnalyticsOptions>(
  (_, _analyticsConfig, providerConfig) => {
    const { dbName = "analytics", dbVersion = 1 } = providerConfig;

    function getAnalyticsDb(): Promise<IDBPDatabase<AnalyticsDB>> {
      if (dbPromise) return dbPromise;
      dbPromise = openDB<AnalyticsDB>(dbName, dbVersion, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("events")) {
            db.createObjectStore("events", {
              keyPath: "id",
              autoIncrement: true,
            });
          }
        },
      });

      return dbPromise;
    }

    async function sendToIDBLog(event: LocalAnalyticsEvent) {
      const db = await getAnalyticsDb();
      await db.add("events", event);
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
