import { ReactNode } from 'react';
import {
  composeExchanges,
  Exchange,
  makeResult,
  OperationResult,
  ssrExchange,
  useClient,
} from 'urql';

import { pipe, tap, filter, map, merge, mergeMap, fromPromise } from 'wonka';

type Promises = Set<Promise<void>>;
const DATA_NAME = '__NEXT_DATA_PROMISE__';
const isServerSide = typeof window === 'undefined';

/**
 * Collecting data from HTML
 */
export const getInitialState = () => {
  if (typeof window !== 'undefined') {
    const node = document.getElementById(DATA_NAME);
    if (node) return JSON.parse(node.innerHTML);
  }
  return undefined;
};

/**
 * Wait until end of Query and output collected data at render time
 */
const DataRender = () => {
  const client = useClient();
  if (isServerSide) {
    const extractData = client.readQuery(`query{extractData}`, {})?.data.extractData;
    if (!extractData) {
      throw client.query(`query{extractData}`, {}).toPromise();
    }
    return (
      <script
        id={DATA_NAME}
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(extractData) }}
      />
    );
  }
  return null;
};

/**
 * For SSR data insertion
 */
export const NextSSRProvider = ({ children }: { children: ReactNode }) => {
  return (
    <>
      {children}
      <DataRender />
    </>
  );
};

const createLocalValueExchange = <T extends object>(key: string, callback: () => Promise<T>) => {
  const localValueExchange: Exchange = (input) => {
    const { forward } = input;
    return (operation) => {
      const filterOps$ = pipe(
        operation,
        filter((op) => {
          const definition = op.query.definitions[0];
          if (definition?.kind === 'OperationDefinition') {
            const selection = definition.selectionSet.selections[0];
            if (selection?.kind === 'Field') {
              if (selection.name.value === key) return false;
            }
          }
          return true;
        }),
        forward
      );
      const valueOps$ = pipe(
        operation,
        mergeMap((op) => {
          const source = fromPromise(
            new Promise<OperationResult>(async (resolve) => {
              resolve(makeResult(op, { data: { [key]: await callback() } }));
            })
          );
          return source;
        })
      );
      return merge([filterOps$, valueOps$]);
    };
  };
  return localValueExchange;
};

/**
 * Query standby extensions
 */
export const createNextSSRExchange = () => {
  const promises: Promises = new Set();

  const _ssrExchange = ssrExchange({
    isClient: !isServerSide,
    // Set up initial data required for SSR
    initialState: getInitialState(),
  });
  const _nextExchange: Exchange = (input) => {
    const { forward } = input;

    return (operation) => {
      if (!isServerSide) {
        return forward(operation);
      } else {
        return pipe(
          operation,
          tap((op) => {
            if (op.kind === 'query') {
              const promise = new Promise<void>((resolve) => {
                op.context.resolve = resolve;
              });
              promises.add(promise);
            }
          }),
          forward,
          tap((op) => {
            if (op.operation.kind === 'query') {
              op.operation.context.resolve();
            }
          })
        );
      }
    };
  };
  return composeExchanges(
    [
      _ssrExchange,
      isServerSide &&
        createLocalValueExchange('extractData', async () => {
          let length: number;
          while ((length = promises?.size)) {
            await Promise.allSettled(promises).then(() => {
              if (length === promises.size) {
                promises.clear();
              }
            });
          }
          return _ssrExchange.extractData();
        }),
      _nextExchange,
    ].filter((v): v is Exchange => v !== false)
  );
};
