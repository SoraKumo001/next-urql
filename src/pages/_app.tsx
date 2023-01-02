import { multipartFetchExchange } from '@urql/exchange-multipart-fetch';
import { Client, Provider } from 'urql';
import { createNextSSRExchange, NextSSRProvider } from '../libs/urql-ssr';
import type { AppType } from 'next/app';

const endpoint = '/api/graphql';
const url =
  typeof window === 'undefined'
    ? `${
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
      }${endpoint}`
    : endpoint;

const isServerSide = typeof window === 'undefined';

const App: AppType = ({ Component, pageProps }) => {
  const nextSSRExchange = createNextSSRExchange();
  const client = new Client({
    url,
    fetchOptions: { headers: { 'apollo-require-preflight': 'true' } },
    // Server側のみ'throw promise'を行う
    suspense: isServerSide,
    exchanges: [
      // promiseExchangeでSSRに必要な待機作業を行う
      nextSSRExchange,
      multipartFetchExchange,
    ],
  });
  return (
    <Provider value={client}>
      {/* SSR用データ収集機能の追加 */}
      <NextSSRProvider>
        <Component {...pageProps} />
      </NextSSRProvider>
    </Provider>
  );
};

// Next.jsの最適化を防止するため、何もしないgetInitialPropsを作成
App.getInitialProps = () => ({});

export default App;
