import { ssrExchange, cacheExchange } from '@urql/core';
import { multipartFetchExchange } from '@urql/exchange-multipart-fetch';
import { createClient, Provider } from 'urql';
import { getSSRData, promiseExchange, SSRProvider } from '../libs/urql-ssr';
import type { AppType } from 'next/app';

const endpoint = '/api/graphql';
const url =
  typeof window === 'undefined'
    ? `${
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
      }${endpoint}`
    : endpoint;

const isServerSide = typeof window === 'undefined';

const ssr = ssrExchange({
  isClient: !isServerSide,
  // SSRに必要な初期データの設定
  initialState: getSSRData(),
});

const App: AppType = ({ Component, pageProps }) => {
  const client = createClient({
    url,
    fetchOptions: { headers: { 'apollo-require-preflight': 'true' } },
    // Server側のみ'throw promise'を行う
    suspense: isServerSide,
    exchanges: [
      cacheExchange,
      ssr,
      // promiseExchangeでSSRに必要な待機作業を行う
      promiseExchange,
      multipartFetchExchange,
    ],
  });
  return (
    <Provider value={client}>
      {/* SSR用データ収集機能の追加 */}
      <SSRProvider ssr={ssr}>
        <Component {...pageProps} />
      </SSRProvider>
    </Provider>
  );
};

// Next.jsの最適化を防止するため、何もしないgetInitialPropsを作成
App.getInitialProps = () => ({});

export default App;
