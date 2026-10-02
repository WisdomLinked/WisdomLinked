import FaqList from './FaqList';

type Props = {
  onSelectFaq: (question: string) => void;
  disabled?: boolean;
};

export default function WelcomePanel({ onSelectFaq, disabled }: Props) {
  return (
    <div className="p-5">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Hi there 👋</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ask me anything about WisdomLinked, or pick a common question below.
        </p>
      </div>
      <FaqList onSelect={onSelectFaq} disabled={disabled} />
    </div>
  );
}
