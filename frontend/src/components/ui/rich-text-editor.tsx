"use client";

import { Highlight } from "@tiptap/extension-highlight";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface RichTextEditorProps {
  label: string;
  /** Editor document (JSON), or null for empty. */
  value: JSONContent | null;
  onChange: (value: JSONContent | null) => void;
  placeholder?: string;
  error?: string;
  className?: string;
}

const isEmpty = (editor: Editor) => editor.isEmpty || editor.getText().trim() === "";

/** The editor's schema: what the editor can write and the viewer can show. */
const extensions = (placeholder = "") => [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto", "tel"], defaultProtocol: "https" },
  }),
  Subscript,
  Superscript,
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TableKit.configure({ table: { resizable: false } }),
  CharacterCount,
  Placeholder.configure({ placeholder }),
];

/** Read-only rendering of a rich-text document (through the same schema, never raw HTML). */
export function RichTextView({ value, className }: { value: JSONContent | null; className?: string }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: extensions(),
    content: value ?? "",
    editorProps: { attributes: { class: cn("prose-editor text-sm text-ink", className) } },
  });
  return <EditorContent editor={editor} />;
}

/**
 * WYSIWYG editor (Tiptap): undo/redo, bold, italic, underline, strike, sub/superscript,
 * links, text and highlight colour, alignment, lists and indent, quote, divider and
 * tables, with a word and character count. The value is the editor's JSON document.
 */
export function RichTextEditor({ label, value, onChange, placeholder, error, className }: RichTextEditorProps) {
  const id = useId();
  const editor = useEditor({
    // The desk renders on the client only; skip the server render Tiptap would warn about.
    immediatelyRender: false,
    extensions: extensions(placeholder),
    content: value ?? "",
    editorProps: {
      attributes: {
        id,
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        class: "prose-editor min-h-28 px-3 py-2 text-sm text-ink focus:outline-none",
      },
    },
    onUpdate: ({ editor: current }) => onChange(isEmpty(current) ? null : current.getJSON()),
  });

  const counts = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      words: current?.storage.characterCount.words() ?? 0,
      characters: current?.storage.characterCount.characters() ?? 0,
    }),
  });

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs text-ink-muted">
        {label}
      </label>
      <div className={cn("overflow-hidden rounded-md border border-line bg-surface", error && "border-danger")}>
        {editor && <Toolbar editor={editor} />}
        <EditorContent editor={editor} />
        <div className="flex justify-end gap-3 border-t border-line px-3 py-1 text-[11px] text-ink-faint tabular-nums">
          <span>{counts?.words ?? 0} words</span>
          <span>{counts?.characters ?? 0} characters</span>
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded text-ink-muted hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4",
        active && "bg-accent-soft text-accent-strong",
      )}
    >
      {children}
    </button>
  );
}

function ColorButton({ label, icon, onPick }: { label: string; icon: ReactNode; onPick: (color: string) => void }) {
  return (
    <label title={label} className="relative flex size-7 cursor-pointer items-center justify-center rounded text-ink-muted hover:bg-hover hover:text-ink [&_svg]:size-4">
      <span className="sr-only">{label}</span>
      {icon}
      <input type="color" className="absolute inset-0 cursor-pointer opacity-0" onChange={(event) => onPick(event.target.value)} />
    </label>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />;

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      subscript: current.isActive("subscript"),
      superscript: current.isActive("superscript"),
      link: current.isActive("link"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      blockquote: current.isActive("blockquote"),
      table: current.isActive("table"),
      align: (["left", "center", "right", "justify"] as const).find((align) => current.isActive({ textAlign: align })) ?? "left",
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  function setLink() {
    const previous = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("Link URL (https://…, mailto:…)", previous);
    if (url === null) return;
    if (url.trim() === "") chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-line bg-canvas px-1.5 py-1">
      <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 />
      </ToolButton>
      <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 />
      </ToolButton>
      <Divider />
      <ToolButton label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </ToolButton>
      <ToolButton label="Underline" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <UnderlineIcon />
      </ToolButton>
      <ToolButton label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough />
      </ToolButton>
      <ToolButton label="Subscript" active={state.subscript} onClick={() => chain().toggleSubscript().run()}>
        <SubscriptIcon />
      </ToolButton>
      <ToolButton label="Superscript" active={state.superscript} onClick={() => chain().toggleSuperscript().run()}>
        <SuperscriptIcon />
      </ToolButton>
      <ToolButton label="Link" active={state.link} onClick={setLink}>
        <Link2 />
      </ToolButton>
      <ColorButton label="Text colour" icon={<Palette />} onPick={(color) => chain().setColor(color).run()} />
      <ColorButton label="Highlight colour" icon={<Highlighter />} onPick={(color) => chain().setHighlight({ color }).run()} />
      <Divider />
      <ToolButton label="Align left" active={state.align === "left"} onClick={() => chain().setTextAlign("left").run()}>
        <AlignLeft />
      </ToolButton>
      <ToolButton label="Align center" active={state.align === "center"} onClick={() => chain().setTextAlign("center").run()}>
        <AlignCenter />
      </ToolButton>
      <ToolButton label="Align right" active={state.align === "right"} onClick={() => chain().setTextAlign("right").run()}>
        <AlignRight />
      </ToolButton>
      <ToolButton label="Justify" active={state.align === "justify"} onClick={() => chain().setTextAlign("justify").run()}>
        <AlignJustify />
      </ToolButton>
      <Divider />
      <ToolButton label="Bullet list" active={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
        <List />
      </ToolButton>
      <ToolButton label="Numbered list" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolButton>
      <ToolButton label="Indent" onClick={() => chain().sinkListItem("listItem").run()}>
        <IndentIncrease />
      </ToolButton>
      <ToolButton label="Outdent" onClick={() => chain().liftListItem("listItem").run()}>
        <IndentDecrease />
      </ToolButton>
      <ToolButton label="Quote" active={state.blockquote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote />
      </ToolButton>
      <ToolButton label="Divider" onClick={() => chain().setHorizontalRule().run()}>
        <Minus />
      </ToolButton>
      <Divider />
      <ToolButton label="Insert table" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <TableIcon />
      </ToolButton>
      {state.table && (
        <>
          <button type="button" className="rounded px-1.5 text-xs text-ink-muted hover:bg-hover" onMouseDown={(event) => event.preventDefault()} onClick={() => chain().addRowAfter().run()}>
            + Row
          </button>
          <button type="button" className="rounded px-1.5 text-xs text-ink-muted hover:bg-hover" onMouseDown={(event) => event.preventDefault()} onClick={() => chain().addColumnAfter().run()}>
            + Column
          </button>
          <button type="button" className="rounded px-1.5 text-xs text-ink-muted hover:bg-hover" onMouseDown={(event) => event.preventDefault()} onClick={() => chain().deleteRow().run()}>
            − Row
          </button>
          <button type="button" className="rounded px-1.5 text-xs text-ink-muted hover:bg-hover" onMouseDown={(event) => event.preventDefault()} onClick={() => chain().deleteColumn().run()}>
            − Column
          </button>
          <ToolButton label="Delete table" onClick={() => chain().deleteTable().run()}>
            <Trash2 />
          </ToolButton>
        </>
      )}
    </div>
  );
}
