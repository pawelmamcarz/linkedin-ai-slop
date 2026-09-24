/**
 * Wspólne API rozszerzenia dla Chrome, Brave, Edge (chrome.*) i Safari (browser.*).
 * Wywołania czytają namespace w momencie użycia, żeby testy mogły podstawić atrapę.
 */
(function (root, factory) {
  const api = factory(root);
  root.ExtApi = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function factory(root) {
  const DEFAULT_PROXY_ORIGIN = "https://proxy-production-ebcc.up.railway.app";

  function namespace() {
    const browserNs = root.browser;
    const chromeNs = root.chrome;
    if (browserNs?.runtime && typeof browserNs.runtime.sendMessage === "function") {
      return browserNs;
    }
    if (chromeNs?.runtime) return chromeNs;
    return null;
  }

  function hasRuntime() {
    const ns = namespace();
    return Boolean(ns?.runtime?.id);
  }

  function lastError() {
    return namespace()?.runtime?.lastError || null;
  }

  function call(fn, args) {
    let returned;
    try {
      returned = fn(...args);
    } catch (error) {
      returned = undefined;
      if (!args.length) throw error;
    }
    if (returned && typeof returned.then === "function") return returned;
    return new Promise((resolve, reject) => {
      let settled = false;
      try {
        const maybe = fn(...args, (value) => {
          if (settled) return;
          settled = true;
          const err = lastError();
          if (err) reject(new Error(err.message || "extension api error"));
          else resolve(value);
        });
        if (maybe && typeof maybe.then === "function") {
          maybe.then(
            (value) => {
              if (settled) return;
              settled = true;
              resolve(value);
            },
            (error) => {
              if (settled) return;
              settled = true;
              reject(error);
            },
          );
        }
      } catch (error) {
        if (!settled) reject(error);
      }
    });
  }

  function storageAreas() {
    const storage = namespace()?.storage;
    if (!storage) return [];
    const areas = [];
    if (storage.sync) areas.push(storage.sync);
    if (storage.local && storage.local !== storage.sync) areas.push(storage.local);
    return areas;
  }

  async function storageGet(defaults) {
    for (const area of storageAreas()) {
      try {
        const stored = await call(area.get.bind(area), [defaults]);
        if (stored && typeof stored === "object") return stored;
      } catch {
        /* Safari czasem nie ma sync bez iCloud — schodzimy na local */
      }
    }
    return { ...defaults };
  }

  async function storageSet(values) {
    const areas = storageAreas();
    if (!areas.length) throw new Error("Brak storage w rozszerzeniu");
    let lastErrorSeen = null;
    for (const area of areas) {
      try {
        await call(area.set.bind(area), [values]);
        return;
      } catch (error) {
        lastErrorSeen = error;
      }
    }
    throw lastErrorSeen || new Error("Nie udało się zapisać ustawień");
  }

  function onStorageChanged(listener) {
    const onChanged = namespace()?.storage?.onChanged;
    if (!onChanged?.addListener) return;
    onChanged.addListener((changes, area) => {
      if (area !== "sync" && area !== "local") return;
      listener(changes, area);
    });
  }

  function sendMessage(message) {
    const runtime = namespace()?.runtime;
    if (!runtime?.sendMessage) {
      return Promise.reject(new Error("Brak runtime.sendMessage"));
    }
    return call(runtime.sendMessage.bind(runtime), [message]);
  }

  function onMessage(listener) {
    const runtime = namespace()?.runtime;
    if (!runtime?.onMessage?.addListener) return;
    runtime.onMessage.addListener((message, sender, sendResponse) => {
      const result = listener(message, sender, sendResponse);
      return result;
    });
  }

  function manifestGrants(origin) {
    let url;
    try {
      url = new URL(origin);
    } catch {
      return false;
    }
    const host = url.hostname;
    if (url.origin === DEFAULT_PROXY_ORIGIN) return true;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return true;
    return false;
  }

  async function permissionsContains(origin) {
    if (manifestGrants(origin)) return true;
    const contains = namespace()?.permissions?.contains;
    if (!contains) return false;
    try {
      return Boolean(await call(contains.bind(namespace().permissions), [{ origins: [origin] }]));
    } catch {
      return false;
    }
  }

  async function permissionsRequest(origin) {
    if (manifestGrants(origin)) return true;
    const request = namespace()?.permissions?.request;
    if (!request) return false;
    try {
      return Boolean(await call(request.bind(namespace().permissions), [{ origins: [origin] }]));
    } catch {
      return false;
    }
  }

  return {
    hasRuntime,
    storageGet,
    storageSet,
    onStorageChanged,
    sendMessage,
    onMessage,
    manifestGrants,
    permissionsContains,
    permissionsRequest,
  };
});
