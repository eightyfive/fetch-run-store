import { create as createStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

interface ApiStoreState {
  data: Record<string, unknown>;
  errors: Record<string, Error | null>;
  fetching: Record<string, boolean>;
  fresh: Record<string, boolean>;
  revision: Record<string, number>;
}

const initialNamespace = {
  data: {},
  errors: {},
  fetching: {},
  fresh: {},
  revision: {},
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

function flightKey(ns: string, id: string) {
  return `${ns}/${id}`;
}

function invalidateFlight(key: string) {
  if (!flights.has(key)) {
    return;
  }

  flights.delete(key);
}

function invalidateNamespaceFlights(ns: string) {
  const prefix = `${ns}/`;
  for (const key of flights.keys()) {
    if (key.startsWith(prefix)) {
      invalidateFlight(key);
    }
  }
}

function matchesQueryId(queryId: string, id: string) {
  return queryId === id || (!id.includes("?") && queryId.startsWith(`${id}?`));
}

function invalidateMatchingFlights(ns: string, id: string) {
  for (const key of flights.keys()) {
    const queryId = key.slice(`${ns}/`.length);

    if (key.startsWith(`${ns}/`) && matchesQueryId(queryId, id)) {
      invalidateFlight(key);
    }
  }
}

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
  request: () => Promise<unknown>,
) {
  const key = flightKey(ns, id);
  const existing = flights.get(key);

  if (existing) {
    return existing;
  }

  setQueryExecuting(ns, id);

  const promise = new Promise<unknown>((resolve) => resolve(request()))
    .then((data) => {
      if (flights.get(key) === promise) {
        setQueryExecuted(ns, id, data);
      }
    })
    .catch((error: unknown) => {
      const normalizedError = toError(error);

      if (flights.get(key) === promise) {
        setQueryErrored(ns, id, normalizedError);
      }

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

export function setQueryData<T extends object>(
  ns: string,
  id: string,
  data: T,
): void {
  store.setState((state) => {
    const namespace = state.namespaces[ns] ?? { ...initialNamespace };

    return {
      namespaces: {
        ...state.namespaces,
        [ns]: {
          ...namespace,
          data: { ...namespace.data, [id]: data },
        },
      },
    };
  });
}

export function invalidateQuery(ns: string, id: string) {
  invalidateMatchingFlights(ns, id);

  store.setState((state) => {
    const namespace = state.namespaces[ns] ?? { ...initialNamespace };
    const ids = new Set([
      id,
      ...Object.keys(namespace.data),
      ...Object.keys(namespace.errors),
      ...Object.keys(namespace.fetching),
      ...Object.keys(namespace.fresh),
    ]);
    const matchedIds = [...ids].filter((queryId) =>
      matchesQueryId(queryId, id),
    );

    const errors = { ...namespace.errors };
    const fresh = { ...namespace.fresh };
    const fetching = { ...namespace.fetching };
    const revision = { ...namespace.revision };

    for (const queryId of matchedIds) {
      errors[queryId] = null;
      fresh[queryId] = false;
      fetching[queryId] = false;
      revision[queryId] = (revision[queryId] ?? 0) + 1;
    }

    return {
      namespaces: {
        ...state.namespaces,
        [ns]: {
          ...namespace,
          errors,
          fresh,
          fetching,
          revision,
        },
      },
    };
  });
}

export function invalidateQueries(ns: string) {
  invalidateNamespaceFlights(ns);

  store.setState((state) => ({
    namespaces: {
      ...state.namespaces,
      [ns]: {
        ...initialNamespace,
        data: state.namespaces[ns]?.data ?? {},
        revision: nextRevisions(state.namespaces[ns]),
      },
    },
  }));
}

export function resetQueries(ns: string) {
  invalidateNamespaceFlights(ns);

  store.setState((state) => ({
    namespaces: {
      ...state.namespaces,
      [ns]: {
        ...initialNamespace,
        revision: nextRevisions(state.namespaces[ns]),
      },
    },
  }));
}

function nextRevisions(namespace: ApiStoreState | undefined) {
  const keys = new Set([
    ...Object.keys(namespace?.fetching ?? {}),
    ...Object.keys(namespace?.revision ?? {}),
  ]);
  return Object.fromEntries(
    [...keys].map((id) => [id, (namespace?.revision[id] ?? 0) + 1]),
  );
}

export function useApiStore<T>(
  ns: string,
  selector: (namespace: ApiStoreState) => T,
) {
  return store(
    useShallow((state) => selector(state.namespaces[ns] ?? initialNamespace)),
  );
}
