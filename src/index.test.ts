import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

interface MockIDBRequest {
  result: unknown;
  error: DOMException | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onupgradeneeded: ((event: { target: { result: unknown } }) => void) | null;
}

interface MockIDBObjectStore {
  add: Mock;
}

interface MockIDBTransaction {
  objectStore: Mock;
}

interface MockIDBDatabase {
  objectStoreNames: {
    contains: Mock;
  };
  createObjectStore: Mock;
  transaction: Mock;
}

function createIDBRequestMock(result: unknown): MockIDBRequest {
  const request: MockIDBRequest = {
    result,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  };
  return request;
}

describe("wxt local analytics provider", () => {
  let indexedDBOpenMock: Mock;
  let dbMock: MockIDBDatabase;
  let transactionMock: MockIDBTransaction;
  let objectStoreMock: MockIDBObjectStore;
  let addRequestMock: MockIDBRequest;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Mock IDB infrastructure
    addRequestMock = createIDBRequestMock(undefined);

    objectStoreMock = {
      add: vi.fn(() => {
        setTimeout(() => {
          if (addRequestMock.onsuccess) addRequestMock.onsuccess();
        }, 0);
        return addRequestMock;
      }),
    };

    transactionMock = {
      objectStore: vi.fn(() => objectStoreMock),
    };

    dbMock = {
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(false),
      },
      createObjectStore: vi.fn(),
      transaction: vi.fn(() => transactionMock),
    };

    indexedDBOpenMock = vi.fn(() => {
      const request = createIDBRequestMock(dbMock);
      // Simulate success after a tick
      setTimeout(() => {
        // If upgrade needed logic is required, it's tricky to mock perfectly without more state,
        // but for now let's assume if we need upgrade we trigger it, else success.
        // For simplicity in these tests, we'll just trigger success,
        // but we need to expose the ability to trigger upgrade for specific tests.
        if (request.onsuccess) request.onsuccess();
      }, 10);
      return request;
    });

    vi.stubGlobal("indexedDB", {
      open: indexedDBOpenMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores page events in the events store", async () => {
    const module = await import("./index");
    const providerFactory = module.default;

    const provider = providerFactory({ dbName: "analytics", dbVersion: 1 })(
      {} as never,
      {} as never,
    );

    const pageEvent = { name: "Home", path: "/" } as never;
    await provider.page(pageEvent);

    expect(indexedDBOpenMock).toHaveBeenCalledWith("analytics", 1);
    expect(dbMock.transaction).toHaveBeenCalledWith("events", "readwrite");
    expect(transactionMock.objectStore).toHaveBeenCalledWith("events");

    expect(objectStoreMock.add).toHaveBeenCalledTimes(1);
    expect(objectStoreMock.add).toHaveBeenCalledWith({
      type: "page",
      event: pageEvent,
    });
  });

  it("stores track events in the events store", async () => {
    const module = await import("./index");
    const providerFactory = module.default;

    const provider = providerFactory({ dbName: "analytics", dbVersion: 1 })(
      {} as never,
      {} as never,
    );

    const trackEvent = {
      name: "Button Clicked",
      properties: { section: "hero" },
    } as never;
    await provider.track(trackEvent);

    expect(objectStoreMock.add).toHaveBeenCalledTimes(1);
    expect(objectStoreMock.add).toHaveBeenCalledWith({
      type: "track",
      event: trackEvent,
    });
  });

  it("uses default db configuration when provider config is empty", async () => {
    const module = await import("./index");
    const providerFactory = module.default;

    const provider = providerFactory({} as never)({} as never, {} as never);
    await provider.page({ name: "Home", path: "/" } as never);

    expect(indexedDBOpenMock).toHaveBeenCalledWith("analytics", 1);
  });

  it("uses custom db configuration from provider options", async () => {
    const module = await import("./index");
    const providerFactory = module.default;

    const provider = providerFactory({
      dbName: "my-extension-db",
      dbVersion: 3,
    })({} as never, {} as never);
    await provider.track({ name: "Custom Event" } as never);

    expect(indexedDBOpenMock).toHaveBeenCalledWith("my-extension-db", 3);
  });

  it("does not write events for identify", async () => {
    const module = await import("./index");
    const providerFactory = module.default;

    const provider = providerFactory({ dbName: "analytics", dbVersion: 1 })(
      {} as never,
      {} as never,
    );

    await provider.identify({} as never);
    expect(objectStoreMock.add).not.toHaveBeenCalled();
  });

  it("initializes object store if missing", async () => {
    // Custom mock for this test to trigger upgrade
    indexedDBOpenMock.mockImplementation(() => {
      const request = createIDBRequestMock(dbMock);
      setTimeout(() => {
        if (request.onupgradeneeded)
          request.onupgradeneeded({ target: { result: dbMock } });
        if (request.onsuccess) request.onsuccess();
      }, 10);
      return request;
    });

    const module = await import("./index");
    const providerFactory = module.default;

    const provider = providerFactory({ dbName: "analytics", dbVersion: 1 })(
      {} as never,
      {} as never,
    );

    // Trigger a call to init DB
    await provider.page({ name: "Home", path: "/" } as never);

    expect(dbMock.objectStoreNames.contains).toHaveBeenCalledWith("events");
    expect(dbMock.createObjectStore).toHaveBeenCalledWith("events", {
      keyPath: "id",
      autoIncrement: true,
    });
  });
});
