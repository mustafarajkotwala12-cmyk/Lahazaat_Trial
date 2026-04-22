import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './globals.css';
import 'react-quill/dist/quill.snow.css';

const THEME_STORAGE_KEY = 'lahazaat-theme';

export default function App({ Component, pageProps }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return 'white';
    }

    return window.localStorage.getItem(THEME_STORAGE_KEY) || 'white';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar theme={theme} onThemeChange={setTheme} />
      <main className="flex-1 px-5 py-8">
        <Component {...pageProps} />
      </main>
      <Footer />
    </div>
  );
}
