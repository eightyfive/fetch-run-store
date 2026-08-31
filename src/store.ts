import { create as createStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

interface ApiStoreState {
  data: Record<string, unknown>;
  errors: Record<string, Error | null>;
  fetching: Record<string, boolean>;
  fresh: Record<string, boolean>;
}

const initialNamespace = {
  data: {},
  errors: {},
  fetching: {},
  fresh: {},
};

type RootState = {
  namespaces: Record<string, ApiStoreState>;
};

export const store = createStore<RootState>(() => ({
  namespaces: {},
}));

// Flights are keyed by cache identity: the first request wins and later callers
// share its promise until it settles.
const flights = new Map<string, Promise<void>>();

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
          // Freshness stays as-is until the request succeeds.
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
          fresh: { ...namespace.fresh, [id]: true },
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
  const key = `${ns}/${id}`;
  const existing = flights.get(key);

  if (existing) {
    return existing;
  }

  setQueryExecuting(ns, id);

  const promise = new Promise<unknown>((resolve) => resolve(request()))
    .then((data) => setQueryExecuted(ns, id, data))
    .catch((error: unknown) => {
      const normalizedError = toError(error);
      setQueryErrored(ns, id, normalizedError);
      throw normalizedError;
    })
    .finally(() => {
      if (flights.get(key) === promise) {
        flights.delete(key);
      }
    });

  flights.set(key, promise);

  return promise;
}

export function invalidateQuery(ns: string, id: string) {
  store.setState((state) => {
    const namespace = state.namespaces[ns] ?? { ...initialNamespace };

    if (!namespace.errors[id] && namespace.fresh[id] === false) {
      return state;
    }

    return {
      namespaces: {
        ...state.namespaces,
        [ns]: {
          ...namespace,
          errors: { ...namespace.errors, [id]: null },
          fresh: { ...namespace.fresh, [id]: false },
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
