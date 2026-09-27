import {
  ChevronRight,
  CreditCard,
  MessageSquare,
  Star,
  UserRound,
} from 'lucide-react';
import type { StudentTodo } from '../../utils/studentDiscovery';

type Props = {
  todos: StudentTodo[];
  onSelect: (todo: StudentTodo) => void;
};

const ICONS = {
  user: UserRound,
  star: Star,
  'credit-card': CreditCard,
  message: MessageSquare,
} as const;

export default function YourTodosCard({ todos, onSelect }: Props) {
  if (!todos.length) return null;

  return (
    <aside className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-xl font-semibold text-slate-900">Your to-dos</h3>
        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[#234C6A]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#234C6A]">
          {todos.length}
        </span>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
        {todos.map((todo) => {
          const Icon = ICONS[todo.icon];
          return (
            <li key={todo.id}>
              <button
                type="button"
                onClick={() => onSelect(todo)}
                className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-2 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 line-clamp-2">
                  {todo.label}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
