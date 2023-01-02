import { cacheExchange } from '@urql/exchange-graphcache';
import { ReactNode } from 'react';
import { composeExchanges, Exchange, ssrExchange, useClient } from 'urql';
import { pipe, tap } from 'wonka';
import type { SSRData } from '@urql/core/dist/types/exchanges/ssr';

type Promises = Set<Promise<void>>;
type ExchangeValue = { extractData: () => SSRData; promises: Promises };
const DATA_NAME = '__NEXT_DATA_PROMISE__';
const isServerSide = typeof window === 'undefined';

/**
 * Collecting data from HTML.
 */
export const getInitialState = () => {
  if (typeof window !== 'undefined') {
    const node = document.getElementById(DATA_NAME);
    if (node) return JSON.parse(node.innerHTML);
  }
  return undefined;
};

/**
 * Wait until end of Query and output collected data at render time.
 */
const DataRender = () => {
  const client = useClient();
  const { data } = client.readQuery(`query{exchangeValue}`, {})!;
  const ssrExchange: ExchangeValue = data.exchangeValue;

  const promises = ssrExchange.promises;
  const length = promises?.size;
  if (isServerSide && length) {
    throw Promise.allSettled(promises).then((v) => {
      if (length === promises.size) {
        promises.clear();
      }
      return v;
    });
  }
  return (
    <script
      id={DATA_NAME}
      type="application/json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ssrExchange.extractData()) }}
    />
  );
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

/**
 * Query standby extensions
 */
export const createNextSSRExchange = () => {
  const promises: Promises = new Set();
  const nextExchange: Exchange = (input) => {
    const { forward } = input;
    return (ops) => {
      if (!isServerSide) {
        return forward(ops);
      }
      let resolve: () => void;
      return pipe(
        ops,
        tap((op) => {
          if (op.kind === 'query') {
            const promise = new Promise<void>((r) => {
              resolve = r;
            });
            promises.add(promise);
          }
          return op;
        }),
        forward,
        tap((result) => {
          if (result.operation.kind === 'query') {
            resolve();
          }
          return result;
        })
      );
    };
  };

  const _ssrExchange = ssrExchange({
    isClient: !isServerSide,
    // SSRに必要な初期データの設定
    initialState: getInitialState(),
  });
  const exchangeValue = { extractData: () => _ssrExchange.extractData(), promises };
  return composeExchanges([
    cacheExchange({
      resolvers: {
        Query: {
          exchangeValue: () => exchangeValue,
        },
      },
    }),
    _ssrExchange,
    nextExchange,
  ]);
};
