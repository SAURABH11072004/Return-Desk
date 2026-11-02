"use client";

import { useState } from "react";
import { ErrorAlert } from "@/components/alert";
import { button } from "@/components/button";
import { describedBy, Field, inputClass } from "@/components/field";
import { apiFetch, ApiRequestError, errorMessage, fieldErrors } from "@/lib/api-client";
import type { ReturnDetail, ReturnNote } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { createNoteSchema, toFieldIssues } from "@/lib/validation";

// There is no login, so the agent types their name once; it is remembered on this device as a
// convenience only (the notes themselves live in Postgres).
const AUTHOR_KEY = "returndesk.agentName";

/** Notes are append-only: they can be added in any status and are never edited or deleted. */
export function NotesPanel({ detail, onUpdated }: { detail: ReturnDetail; onUpdated: (detail: ReturnDetail) => void }) {
  const [author, setAuthor] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem(AUTHOR_KEY) ?? ""));
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const check = createNoteSchema.safeParse({ author, body });
    if (!check.success) {
      setErrors(fieldErrors(toFieldIssues(check.error)));
      return;
    }
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const { data: note } = await apiFetch<{ data: ReturnNote }>(
        `/api/returns/${encodeURIComponent(detail.reference)}/notes`,
        { method: "POST", json: check.data },
      );
      localStorage.setItem(AUTHOR_KEY, check.data.author);
      onUpdated({ ...detail, notes: [...detail.notes, note] });
      setBody("");
    } catch (err) {
      setFormError(errorMessage(err));
      if (err instanceof ApiRequestError) setErrors(fieldErrors(err.issues));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
        Notes <span className="font-normal text-slate-500">({detail.notes.length})</span>
      </h2>
      <div className="flex flex-col gap-4 p-4">
        {detail.notes.length === 0 ? (
          <p className="text-sm text-slate-500">No notes yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {detail.notes.map((note) => (
              <li key={note.id} className="rounded-md bg-slate-50 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{note.author}</span>
                  <time dateTime={note.createdAt}>{formatDateTime(note.createdAt)}</time>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">{note.body}</p>
              </li>
            ))}
          </ol>
        )}

        <form onSubmit={submit} noValidate className="flex flex-col gap-3 border-t border-slate-100 pt-4">
          <Field label="Note" htmlFor="note-body" error={errors.body}>
            <textarea
              {...describedBy("note-body", errors.body)}
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What happened, what was agreed, what is next…"
              className={inputClass}
            />
          </Field>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Your name" htmlFor="note-author" error={errors.author}>
                <input
                  {...describedBy("note-author", errors.author)}
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <button type="submit" className={button.primary} disabled={pending}>
              {pending ? "Adding…" : "Add note"}
            </button>
          </div>
          <p className="text-xs text-slate-500">Notes are permanent: they cannot be edited or deleted once added.</p>
          {formError && <ErrorAlert message={formError} />}
        </form>
      </div>
    </section>
  );
}
