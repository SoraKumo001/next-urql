import { multipartFetchExchange } from '@urql/exchange-multipart-fetch';
import { useMemo, useState } from 'react';
import { cacheExchange, Client, Provider } from 'urql';
import { createNextSSRExchange, NextSSRProvider } from '../libs/urql-ssr';
import type { AppType } from 'next/app';

const isServerSide = typeof window === 'undefined';
const endpoint = '/api/graphql';
const url = isServerSide
  ? `${
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
    }${endpoint}`
  : endpoint;

const App: AppType = ({ Component, pageProps }) => {
  // Creation of `Exchange`.
  const [nextSSRExchange] = useState(createNextSSRExchange);
  const client = useMemo(() => {
    return new Client({
      url,
      fetchOptions: {
        headers: {
          // Required for `Upload`.
          'apollo-require-preflight': 'true',
        },
      },
      // Only on the Server side do 'throw promise'.
      suspense: isServerSide,
      exchanges: [cacheExchange, nextSSRExchange, multipartFetchExchange],
    });
  }, [nextSSRExchange]);

  return (
    <Provider value={client}>
      {/* Additional data collection functions for SSR */}
      <NextSSRProvider>
        <Component {...pageProps} />
      </NextSSRProvider>
    </Provider>
  );
};

// Create getInitialProps that do nothing to prevent Next.js optimisation.
App.getInitialProps = () => ({});

export default App;
