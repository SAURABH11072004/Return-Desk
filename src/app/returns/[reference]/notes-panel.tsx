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
    <section className="surface" aria-labelledby="notes-title">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2 id="notes-title" className="text-sm font-semibold text-ink">
            Notes <span className="ml-1 rounded-md bg-surface-3 px-1.5 py-0.5 text-xs font-medium text-muted">{detail.notes.length}</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted">The conversation trail, oldest first.</p>
        </div>
        <span className="hidden items-center gap-1.5 text-xs text-faint sm:flex">
          <Lock aria-hidden className="size-3.5" /> Notes are permanent
        </span>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {detail.notes.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <span className="grid size-11 place-items-center rounded-xl border border-line bg-surface-2 text-faint">
              <MessageSquareText aria-hidden className="size-5" />
            </span>
            <p className="mt-3 text-sm font-medium text-ink">No notes yet</p>
            <p className="mt-0.5 text-xs text-muted">Record what happened and what was agreed with the customer.</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {detail.notes.map((note, i) => (
              <li key={note.id} className="flex animate-fade-up gap-3" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/80 to-[#8b5cf6] text-[11px] font-semibold text-white shadow-card"
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
                  <p className="mt-1.5 whitespace-pre-wrap break-words rounded-xl rounded-tl-sm border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2">
                    {note.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-3 border-t border-line bg-surface-2/60 px-5 py-5 sm:px-6">
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
