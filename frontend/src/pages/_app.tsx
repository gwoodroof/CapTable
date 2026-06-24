import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <Component {...pageProps} />
    </GoogleOAuthProvider>
  );
}
