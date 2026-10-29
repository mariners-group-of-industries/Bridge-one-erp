"use client";

import { RotateCcw, SendHorizontal, Sparkles, Square, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api/client";
import { MAX_HISTORY, type AssistantEvent, type ChatMessage } from "../types";

const SUGGESTIONS = [
  "How are sales this month compared with last month?",
  "Which customers have the most overdue dues?",
  "What stock has not sold in the last 60 days?",
  "Who are my top 5 customers this year?",
];

/** Floating Business Analyst chat, bottom-right on every ERP page. */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, status, error]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function appendToReply(delta: string) {
    setMessages((prev) => {
      const last = prev.at(-1);
      if (!last || last.role !== "assistant") return prev;
      return [...prev.slice(0, -1), { ...last, content: last.content + delta }];
    });
  }

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history: ChatMessage[] = [...messages.filter((m) => m.content.trim()), { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setError(null);
    setStatus("Thinking…");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? `Request failed (${response.status}).`);
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AssistantEvent;
          if (event.type === "text") {
            setStatus(null);
            appendToReply(event.delta);
          } else if (event.type === "status") setStatus(event.text);
          else if (event.type === "error") setError(event.message);
        }
      }
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorMessage(caught));
    } finally {
      abortRef.current = null;
      setBusy(false);
      setStatus(null);
      // Drop the reply bubble if nothing arrived.
      setMessages((prev) => (prev.at(-1)?.role === "assistant" && !prev.at(-1)?.content.trim() ? prev.slice(0, -1) : prev));
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void ask(draft);
    } else if (event.key === "Escape") setOpen(false);
  }

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="Business Analyst"
          className="fixed right-4 bottom-20 z-40 flex h-[min(36rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-dropdown"
        >
          <header className="flex items-center gap-2 border-b border-line px-3 py-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:text-accent">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-ink">Business Analyst</h2>
              <p className="text-xs text-ink-muted">Answers from your ERP data</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="New chat" title="New chat" onClick={newChat} disabled={!messages.length && !busy}>
              <RotateCcw />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setOpen(false)}>
              <X />
            </Button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm" aria-live="polite">
            {!messages.length && (
              <div className="space-y-3">
                <p className="text-ink-muted">
                  Ask about sales, collections, customer dues or stock. Answers use live figures you have access to.
                </p>
                <div className="flex flex-col items-start gap-1.5">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void ask(suggestion)}
                      className="rounded border border-accent-line bg-accent-soft px-2.5 py-1.5 text-left text-xs text-accent-strong hover:bg-accent-line dark:text-accent"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) =>
              message.role === "user" ? (
                <div key={index} className="ml-8 rounded-lg bg-primary px-3 py-2 whitespace-pre-wrap text-primary-fg">
                  {message.content}
                </div>
              ) : message.content ? (
                <div key={index} className="mr-4 rounded-lg bg-control px-3 py-2 text-ink">
                  <Reply text={message.content} />
                </div>
              ) : null,
            )}

            {busy && status && (
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <Spinner className="size-3.5" />
                {status}
              </div>
            )}
            {error && <p className="text-xs text-danger">{error}</p>}
          </div>

          <form onSubmit={onSubmit} className="border-t border-line p-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={2}
                value={draft}
                maxLength={4000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Ask a business question…"
                aria-label="Your question"
                className="max-h-32 min-h-9 flex-1 resize-none rounded border border-line bg-control px-2.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
              />
              {busy ? (
                <Button variant="secondary" size="icon" aria-label="Stop" title="Stop" onClick={() => abortRef.current?.abort()}>
                  <Square />
                </Button>
              ) : (
                <Button type="submit" variant="primary" size="icon" aria-label="Send" disabled={!draft.trim()}>
                  <SendHorizontal />
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-ink-faint">AI can make mistakes. Check important figures in the reports.</p>
          </form>
        </section>
      )}

      <button
        type="button"
        aria-label={open ? "Close Business Analyst" : "Open Business Analyst"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed right-4 bottom-4 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-fg shadow-dropdown transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {open ? <X className="size-5" /> : <Sparkles className="size-5" />}
      </button>
    </>
  );
}

/** Renders the subset of Markdown the assistant is told to use: paragraphs, "-" bullets and **bold**. */
function Reply({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={blocks.length} className="list-disc space-y-0.5 pl-4">
        {bullets.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  for (const line of text.split("\n")) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flush();
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ""))}</p>);
  }
  flush();
  return <div className="space-y-1.5 break-words">{blocks}</div>;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}
