import { createNextSSRExchange, NextSSRProvider } from '@react-libraries/next-exchange-ssr';
import { useMemo, useState } from 'react';
import { cacheExchange, Client, Provider, fetchExchange } from 'urql';
import type { AppType } from 'next/app';

const isServerSide = typeof window === 'undefined';
const endpoint = '/api/graphql';
const url = isServerSide
  ? `${
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
    }${endpoint}`
  : endpoint;

const App: AppType = ({ Component, pageProps }) => {
  // NextSSRExchange to be unique on AppTree
  const [nextSSRExchange] = useState(createNextSSRExchange);

  const client = useMemo(() => {
    return new Client({
      url,
      fetchOptions: {
        headers: {
          //// Required for `Upload`.
          'apollo-require-preflight': 'true',
          //// When authenticating, the useMemo callback is re-executed and the cache is destroyed.
          //'authorization': `Bearer ${token}`
        },
      },
      // Only on the Server side do 'throw promise'.
      suspense: isServerSide,
      exchanges: [cacheExchange, nextSSRExchange, fetchExchange],
    });
  }, [nextSSRExchange /*,token*/]);

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
