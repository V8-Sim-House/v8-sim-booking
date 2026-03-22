export default function Footer() {
  return (
    <footer className="bg-brand-footer-bg border-t border-brand-border-subtle py-10 mt-auto">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <p className="text-brand-text-muted text-sm tracking-wide uppercase">
          &copy; {new Date().getFullYear()} V8 Sim House LLC &mdash; Connecticut, USA
        </p>
        <p className="text-brand-text-muted text-xs mt-2">
          <a href="mailto:support@v8simhouse.com" className="hover:text-brand-red transition-colors">
            support@v8simhouse.com
          </a>
        </p>
      </div>
    </footer>
  );
}
