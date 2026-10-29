import { z } from "zod";

/** Largest rich-text document accepted (serialised JSON). */
export const MAX_RICH_TEXT_LENGTH = 100_000;

export interface RichTextNode {
  type: string;
  text?: string;
  content?: RichTextNode[];
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

/**
 * A rich-text editor document (Tiptap / ProseMirror JSON). Stored as JSON, never as
 * HTML, so it is only ever rendered through the editor's schema.
 */
export const richTextSchema = z
  .object({ type: z.literal("doc"), content: z.array(z.record(z.string(), z.unknown())).optional() })
  .loose()
  .refine((doc) => JSON.stringify(doc).length <= MAX_RICH_TEXT_LENGTH, { error: "The text is too long." })
  .transform((doc) => doc as unknown as RichTextNode);

const BLOCKS = new Set(["paragraph", "heading", "blockquote", "listItem", "tableRow", "codeBlock"]);

/** Plain text of a document: blocks on their own lines, list items bulleted, table cells tab-separated. */
export function richTextToPlain(doc: RichTextNode | null | undefined): string {
  if (!doc) return "";
  const lines: string[] = [];
  let current = "";
  /** List bullet / number waiting for the item's first text. */
  let pending = "";
  const flush = () => {
    if (current.trim()) lines.push(current.trimEnd());
    current = "";
  };
  const walk = (node: RichTextNode, prefix = "") => {
    if (node.type === "text") {
      current += pending + (node.text ?? "");
      pending = "";
      return;
    }
    if (node.type === "hardBreak") {
      flush();
      return;
    }
    if (node.type === "horizontalRule") {
      flush();
      lines.push("────────");
      return;
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      flush();
      (node.content ?? []).forEach((item, index) => walk(item, node.type === "orderedList" ? `${index + 1}. ` : "• "));
      return;
    }
    if (node.type === "tableCell" || node.type === "tableHeader") {
      if (current) current += "\t";
      (node.content ?? []).forEach((child) => walk(child));
      return;
    }
    if (BLOCKS.has(node.type)) flush();
    if (prefix) pending = prefix;
    (node.content ?? []).forEach((child) => walk(child));
    if (BLOCKS.has(node.type)) flush();
  };
  walk(doc);
  flush();
  return lines.join("\n");
}

/** True when the document has no visible text. */
export const isRichTextEmpty = (doc: RichTextNode | null | undefined) => richTextToPlain(doc).trim() === "";
