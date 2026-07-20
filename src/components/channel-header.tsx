export default function ChannelHeader({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
        <div>
          <h1 className="text-base font-semibold text-gray-900"># {title}</h1>
          {description && <p className="text-xs text-gray-900">{description}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}
