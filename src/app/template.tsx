/** Re-mounted on every navigation: a brief fade so page changes feel continuous, not flashy. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
