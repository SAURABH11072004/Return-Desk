/** Re-mounted on every navigation, so each page fades in (disabled under prefers-reduced-motion). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
