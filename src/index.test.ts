import { beforeEach, describe, expect, it, vi } from "vitest";

type OpenDbArgs = {
  dbName: string;
  dbVersion: number;
  options: {
    upgrade: (db: {
      objectStoreNames: { contains: (name: string) => boolean };
      createObjectStore: (
        name: string,
        options: { keyPath: string; autoIncrement: boolean },
      ) => void;
    }) => void;
  };
};

async function setupModule() {
  const addMock = vi.fn();
  const createObjectStoreMock = vi.fn();
  const containsMock = vi.fn().mockReturnValue(false);

  const openDbCalls: OpenDbArgs[] = [];

  vi.doMock("idb", () => ({
    openDB: vi.fn(
      (dbName: string, dbVersion: number, options: OpenDbArgs["options"]) => {
        openDbCalls.push({ dbName, dbVersion, options });

        options.upgrade({
          objectStoreNames: { contains: containsMock },
          createObjectStore: createObjectStoreMock,
        });

        return Promise.resolve({ add: addMock });
      },
    ),
  }));

  const module = await import("./index");

  return {
    providerFactory: module.default,
    addMock,
    createObjectStoreMock,
    containsMock,
    openDbCalls,
  };
}

describe("wxt local analytics provider", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unmock("idb");
  });

  it("stores page events in the events store", async () => {
    const { providerFactory, addMock } = await setupModule();

    const provider = providerFactory({ dbName: "analytics", dbVersion: 1 })(
      {} as never,
      {} as never,
    );

    const pageEvent = { name: "Home", path: "/" } as never;
    await provider.page(pageEvent);

    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledWith("events", {
      type: "page",
      event: pageEvent,
    });
  });

  it("stores track events in the events store", async () => {
    const { providerFactory, addMock } = await setupModule();

    const provider = providerFactory({ dbName: "analytics", dbVersion: 1 })(
      {} as never,
      {} as never,
    );

    const trackEvent = {
      name: "Button Clicked",
      properties: { section: "hero" },
    } as never;
    await provider.track(trackEvent);

    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledWith("events", {
      type: "track",
      event: trackEvent,
    });
  });

  it("uses default db configuration when provider config is empty", async () => {
    const {
      providerFactory,
      openDbCalls,
      containsMock,
      createObjectStoreMock,
    } = await setupModule();

    const provider = providerFactory({} as never)({} as never, {} as never);
    await provider.page({ name: "Home", path: "/" } as never);

    expect(openDbCalls).toHaveLength(1);
    expect(openDbCalls[0].dbName).toBe("analytics");
    expect(openDbCalls[0].dbVersion).toBe(1);
    expect(containsMock).toHaveBeenCalledWith("events");
    expect(createObjectStoreMock).toHaveBeenCalledWith("events", {
      keyPath: "id",
      autoIncrement: true,
    });
  });

  it("uses custom db configuration from provider options", async () => {
    const { providerFactory, openDbCalls } = await setupModule();

    const provider = providerFactory({
      dbName: "my-extension-db",
      dbVersion: 3,
    })({} as never, {} as never);
    await provider.track({ name: "Custom Event" } as never);

    expect(openDbCalls).toHaveLength(1);
    expect(openDbCalls[0].dbName).toBe("my-extension-db");
    expect(openDbCalls[0].dbVersion).toBe(3);
  });

  it("does not write events for identify", async () => {
    const { providerFactory, addMock } = await setupModule();

    const provider = providerFactory({ dbName: "analytics", dbVersion: 1 })(
      {} as never,
      {} as never,
    );

    await provider.identify({} as never);
    expect(addMock).not.toHaveBeenCalled();
  });
});
