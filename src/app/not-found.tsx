import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">There is nothing at this address.</p>
      <Link href="/returns" className="mt-4 inline-block text-sm font-medium text-indigo-700 hover:underline">
        Back to the desk
      </Link>
    </div>
  );
}
