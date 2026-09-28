import Link from "next/link";
import { StatusBadge } from "./StatusBadge";

export interface SiteRow {
  domain: string;
  category: string;
  first_seen_at: string;
  https_enabled: boolean;
  status: string;
  auth_detection: { login_detected: boolean; register_detected: boolean; registration_form_detected: boolean } | null;
  pages: { count: number }[] | null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

export function SitesTable({ rows }: { rows: SiteRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="card py-16 text-center text-muted">
        <p>No sites discovered yet.</p>
        <p className="mt-1 text-xs">Once a discovery run finds a match, it'll show up here.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-muted">
            <th className="px-4 py-3">Domain</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Login</th>
            <th className="px-4 py-3">Register</th>
            <th className="px-4 py-3">Form</th>
            <th className="px-4 py-3">HTTPS</th>
            <th className="px-4 py-3">First Seen</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.domain} className="border-b border-border/60 last:border-0 hover:bg-bg/40">
              <td className="px-4 py-3">
                <Link href={`/sites/${row.domain}`} className="font-medium text-text hover:text-primary">
                  {row.domain}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted">{row.category}</td>
              <td className="px-4 py-3">
                <StatusBadge ok={!!row.auth_detection?.login_detected} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge ok={!!row.auth_detection?.register_detected} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge ok={!!row.auth_detection?.registration_form_detected} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge ok={row.https_enabled} />
              </td>
              <td className="px-4 py-3 text-muted">{timeAgo(row.first_seen_at)}</td>
              <td className="px-4 py-3 text-muted capitalize">{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
