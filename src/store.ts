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

export async function executeQuery(
  ns: string,
  id: string,
  request: () => Promise<unknown>
) {
  const isFetching = store.getState().namespaces[ns]?.fetching[id] === true;

  if (!isFetching) {
    setQueryExecuting(ns, id);

    try {
      const data = await request();

      setQueryExecuted(ns, id, data);
    } catch (err) {
      setQueryErrored(ns, id, err as Error);

      throw err;
    }
  }
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
