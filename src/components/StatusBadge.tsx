export function StatusBadge({ ok, yesLabel = "Yes", noLabel = "No" }: { ok: boolean; yesLabel?: string; noLabel?: string }) {
  return <span className={`badge ${ok ? "badge-yes" : "badge-no"}`}>{ok ? `✓ ${yesLabel}` : noLabel}</span>;
}
