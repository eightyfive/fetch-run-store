import { create as createStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

interface ApiStoreState {
  data: Record<string, unknown>;
  errors: Record<string, Error | null>;
  fetching: Record<string, boolean>;
  stale: Record<string, boolean>;
}

const initialNamespace = {
  data: {},
  errors: {},
  fetching: {},
  stale: {},
};

type RootState = {
  namespaces: Record<string, ApiStoreState>;
};

export const store = createStore<RootState>(() => ({
  namespaces: {},
}));

const inFlightQueries = new Map<string, Map<string, Promise<void>>>();

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function setQueryExecuting(ns: string, id: string) {
  store.setState((state) => {
    const namespace = state.namespaces[ns] ?? { ...initialNamespace };

    return {
      namespaces: {
        ...state.namespaces,
        [ns]: {
          ...namespace,
          errors: { ...namespace.errors, [id]: null },
          fetching: { ...namespace.fetching, [id]: true },
          // stale stays as-is; we clear it on success
        },
      },
    };
  });
}

function setQueryExecuted(ns: string, id: string, data: unknown) {
  store.setState((state) => {
    const namespace = state.namespaces[ns] ?? { ...initialNamespace };

    return {
      namespaces: {
        ...state.namespaces,
        [ns]: {
          ...namespace,
          data: { ...namespace.data, [id]: data },
          fetching: { ...namespace.fetching, [id]: false },
          stale: { ...namespace.stale, [id]: false },
        },
      },
    };
  });
}

function setQueryErrored(ns: string, id: string, error: Error) {
  store.setState((state) => {
    const namespace = state.namespaces[ns] ?? { ...initialNamespace };

    return {
      namespaces: {
        ...state.namespaces,
        [ns]: {
          ...namespace,
          errors: { ...namespace.errors, [id]: error },
          fetching: { ...namespace.fetching, [id]: false },
        },
      },
    };
  });
}

export function executeQuery(
  ns: string,
  id: string,
  request: () => Promise<unknown>
) {
  const namespaceFlights =
    inFlightQueries.get(ns) ?? new Map<string, Promise<void>>();
  const existing = namespaceFlights.get(id);

  if (existing) {
    return existing;
  }

  inFlightQueries.set(ns, namespaceFlights);
  setQueryExecuting(ns, id);

  let promise: Promise<void>;
  promise = new Promise<unknown>((resolve) => resolve(request()))
    .then((data) => setQueryExecuted(ns, id, data))
    .catch((error: unknown) => {
      const normalizedError = toError(error);
      setQueryErrored(ns, id, normalizedError);
      throw normalizedError;
    })
    .finally(() => {
      if (namespaceFlights.get(id) === promise) {
        namespaceFlights.delete(id);
      }

      if (namespaceFlights.size === 0) {
        inFlightQueries.delete(ns);
      }
    });

  namespaceFlights.set(id, promise);

  return promise;
}

export function invalidateQuery(ns: string, id: string) {
  store.setState((state) => {
    const namespace = state.namespaces[ns] ?? { ...initialNamespace };
    return {
      namespaces: {
        ...state.namespaces,
        [ns]: {
          ...namespace,
          errors: { ...namespace.errors, [id]: null },
          stale: { ...namespace.stale, [id]: true },
        },
      },
    };
  });
}

export function invalidateQueries(ns: string) {
  store.setState((state) => ({
    namespaces: {
      ...state.namespaces,
      [ns]: {
        ...initialNamespace,
        data: state.namespaces[ns]?.data ?? {},
      },
    },
  }));
}

export function resetQueries(ns: string) {
  store.setState((state) => ({
    namespaces: {
      ...state.namespaces,
      [ns]: { ...initialNamespace },
    },
  }));
}

export function useApiStore<T>(
  ns: string,
  selector: (namespace: ApiStoreState) => T
) {
  return store(
    useShallow((state) => selector(state.namespaces[ns] ?? initialNamespace))
  );
}
