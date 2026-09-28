import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { Bold, Italic, Link2, List, ListOrdered, Strikethrough, Underline } from 'lucide-react';
import ToolbarButton from './ToolbarButton';

type Props = {
  editor: Editor;
  disabled?: boolean;
  linkOpen: boolean;
  onLinkClick: () => void;
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
const mod = isMac ? '⌘' : 'Ctrl';

export default function FormattingToolbar({ editor, disabled = false, linkOpen, onLinkClick }: Props) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      orderedList: e.isActive('orderedList'),
      bulletList: e.isActive('bulletList'),
      link: e.isActive('link'),
    }),
  });

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ToolbarButton
        label="Bold"
        icon={Bold}
        shortcut={`${mod}+B`}
        pressable
        active={active.bold}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="Italic"
        icon={Italic}
        shortcut={`${mod}+I`}
        pressable
        active={active.italic}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="Underline"
        icon={Underline}
        shortcut={`${mod}+U`}
        pressable
        active={active.underline}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        label="Strikethrough"
        icon={Strikethrough}
        shortcut={`${mod}+Shift+X`}
        pressable
        active={active.strike}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden />
      <ToolbarButton
        label="Numbered list"
        icon={ListOrdered}
        pressable
        active={active.orderedList}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Bulleted list"
        icon={List}
        pressable
        active={active.bulletList}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <span data-composer-trigger="link" className="inline-flex">
        <ToolbarButton
          label="Link"
          icon={Link2}
          shortcut={`${mod}+K`}
          pressable
          active={active.link || linkOpen}
          expanded={linkOpen}
          disabled={disabled}
          onClick={onLinkClick}
        />
      </span>
    </div>
  );
}
