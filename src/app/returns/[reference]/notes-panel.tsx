"use client";

import { LoaderCircle, Lock, MessageSquareText, Send } from "lucide-react";
import { useState } from "react";
import { ErrorAlert } from "@/components/alert";
import { button } from "@/components/button";
import { describedBy, Field, inputClass, textareaClass } from "@/components/field";
import { useToast } from "@/components/toast";
import { apiFetch, ApiRequestError, errorMessage, fieldErrors } from "@/lib/api-client";
import type { ReturnDetail, ReturnNote } from "@/lib/api-types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { createNoteSchema, toFieldIssues } from "@/lib/validation";

// There is no login, so the agent types their name once; it is remembered on this device as a
// convenience only (the notes themselves live in Postgres).
const AUTHOR_KEY = "returndesk.agentName";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((part) => /^[a-z]/i.test(part))
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

/** Notes are append-only: they can be added in any status and are never edited or deleted. */
export function NotesPanel({ detail, onUpdated }: { detail: ReturnDetail; onUpdated: (detail: ReturnDetail) => void }) {
  const toast = useToast();
  const [author, setAuthor] = useState(() => (typeof window === "undefined" ? "" : (localStorage.getItem(AUTHOR_KEY) ?? "")));
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
      const { data: note } = await apiFetch<{ data: ReturnNote }>(`/api/returns/${encodeURIComponent(detail.reference)}/notes`, {
        method: "POST",
        json: check.data,
      });
      localStorage.setItem(AUTHOR_KEY, check.data.author);
      onUpdated({ ...detail, notes: [...detail.notes, note] });
      setBody("");
      toast.success("Note added", `Added to ${detail.reference}.`);
    } catch (err) {
      const message = errorMessage(err);
      setFormError(message);
      toast.error("Unable to add the note", message);
      if (err instanceof ApiRequestError) setErrors(fieldErrors(err.issues));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="notes-title">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <h2 id="notes-title" className="text-[15px] font-semibold text-ink">
            Notes <span className="ml-1 text-sm font-normal text-muted">{detail.notes.length}</span>
          </h2>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Lock aria-hidden className="size-3.5" /> Permanent once added
        </span>
      </div>

      <div className="px-5 py-4">
        {detail.notes.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <span className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-muted">
              <MessageSquareText aria-hidden className="size-4" />
            </span>
            <p className="mt-3 text-sm font-medium text-ink">No notes yet</p>
            <p className="mt-0.5 text-xs text-muted">Record what happened and what was agreed with the customer.</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {detail.notes.map((note) => (
              <li key={note.id} className="flex gap-3">
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-ink-2"
                >
                  {initials(note.author)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium text-ink">{note.author}</span>
                    <time dateTime={note.createdAt} title={formatDateTime(note.createdAt)} className="text-xs text-faint">
                      {formatRelative(note.createdAt)}
                    </time>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-2">
                    {note.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-b-xl border-t border-line bg-surface-2 px-5 py-4">
        <Field label="Add a note" htmlFor="note-body" error={errors.body}>
          <textarea
            {...describedBy("note-body", errors.body)}
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What happened, what was agreed, what is next…"
            className={textareaClass}
          />
        </Field>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Your name" htmlFor="note-author" error={errors.author}>
              <input {...describedBy("note-author", errors.author)} value={author} onChange={(e) => setAuthor(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <button type="submit" className={button.primary} disabled={pending}>
            {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
            Add note
          </button>
        </div>
        {formError && <ErrorAlert message={formError} />}
      </form>
    </section>
  );
}
