export default function EmptyState({ icon = "▧", title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-panel px-6 py-14 text-center shadow-lg shadow-black/20 ring-1 ring-line">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber/15 text-xl text-amber ring-1 ring-amber/30">
        {icon}
      </div>
      <h3 className="font-display text-base font-bold text-frost">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-ash">{message}</p>}
      {action}
    </div>
  );
}
