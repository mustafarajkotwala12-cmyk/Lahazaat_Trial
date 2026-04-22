import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-auto px-5 pb-5 pt-1">
      <div className="glass-panel mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 rounded-[2rem] px-6 py-5 md:flex-row">
        <div className="mb-0 text-sm text-slate-400">
          © 2026 Lahazaat. All rights reserved.
        </div>
        <div className="flex space-x-4">
          <a href="/privacy" className="text-sm text-slate-400 hover:text-slate-700">Privacy Policy</a>
          <a href="/terms" className="text-sm text-slate-400 hover:text-slate-700">Terms of Service</a>
          <a href="/contact" className="text-sm text-slate-400 hover:text-slate-700">Contact</a>
        </div>
      </div>
    </footer>
  );
}
