import { ssrExchange } from '@urql/core';
import { ReactNode } from 'react';
import { Client, Exchange, useClient } from 'urql';
import { pipe, tap } from 'wonka';

type Promises = Set<Promise<void>>;
const DATA_NAME = '__NEXT_DATA_PROMISE__';
const isServerSide = typeof window === 'undefined';

/**
 * HTMLからデータの収集
 */
export const getSSRData = () => {
  if (typeof window !== 'undefined') {
    const node = document.getElementById(DATA_NAME);
    if (node) return JSON.parse(node.innerHTML);
  }
  return undefined;
};

/**
 * Query終了まで待機して、収集したデータをレンダリング時に出力
 */
const DataRender = ({ ssr }: { ssr: ReturnType<typeof ssrExchange> }) => {
  const client = useClient();
  const promises = (client as unknown as { promises?: Promises }).promises;
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ssr.extractData()) }}
    />
  );
};

/**
 * SSRデータ挿入用
 */
export const SSRProvider = ({
  ssr,
  children,
}: {
  ssr: ReturnType<typeof ssrExchange>;
  children: ReactNode;
}) => {
  return (
    <>
      {children}
      <DataRender ssr={ssr} />
    </>
  );
};

/**
 * Query待機用拡張機能
 */
export const promiseExchange: Exchange = (input) => {
  const { client, forward } = input;
  const promises: Promises = new Set();
  (client as Client & { promises?: Promises }).promises = promises;
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
