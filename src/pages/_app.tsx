import { multipartFetchExchange } from '@urql/exchange-multipart-fetch';
import { Client, Provider } from 'urql';
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
  const nextSSRExchange = createNextSSRExchange();
  const client = new Client({
    url,
    fetchOptions: {
      headers: {
        // Required for `Upload`.
        'apollo-require-preflight': 'true',
      },
    },
    // Only on the Server side do 'throw promise'.
    suspense: isServerSide,
    exchanges: [nextSSRExchange, multipartFetchExchange],
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

// Create getInitialProps that do nothing to prevent Next.js optimisatio
App.getInitialProps = () => ({});

export default App;
