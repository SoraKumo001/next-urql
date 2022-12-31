import type { AppType } from 'next/app';
import { createClient, Provider } from 'urql';
import { ssrExchange, cacheExchange } from '@urql/core';
import { multipartFetchExchange } from '@urql/exchange-multipart-fetch';

import { getSSRData, promiseExchange, SSRProvider } from '../libs/urql-ssr';
const isServerSide = typeof window === 'undefined';

const ssr = ssrExchange({
  isClient: !isServerSide,
  initialState: getSSRData(),
});

const endpoint = '/api/graphql';
const url =
  typeof window === 'undefined'
    ? `${
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
      }${endpoint}`
    : endpoint;

const App: AppType = ({ Component, pageProps }) => {
  const client = createClient({
    url,
    suspense: isServerSide,
    exchanges: [cacheExchange, ssr, promiseExchange, multipartFetchExchange],
  });
  return (
    <Provider value={client}>
      <SSRProvider ssr={ssr}>
        <Component {...pageProps} />
      </SSRProvider>
    </Provider>
  );
};
App.getInitialProps = () => ({});

export default App;
