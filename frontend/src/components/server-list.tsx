'use client';
import { useEffect, useState } from 'react';
import clsx from 'classnames';
import { NEXT_PUBLIC_API_URL } from '@/config/env';

interface MCPServer {
  id: string;
  name: string;
  category: string;
}

interface Props {
  active: string | null;
  onSelect: (id: string) => void;
}

export default function ServerList({ active, onSelect }: Props) {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const response = await fetch(`${NEXT_PUBLIC_API_URL}/servers`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setServers(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to fetch servers');
        setServers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, []);

  return (
    <aside className="w-60 shrink-0 border-r bg-background p-4">
      <h2 className="mb-4 text-lg font-semibold">MCP Servers</h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {servers.map((s) => (
            <li key={s.id}>
              <button
                className={clsx(
                  'w-full rounded-md px-2 py-1 text-left hover:bg-accent',
                  active === s.id && 'bg-primary text-primary-foreground'
                )}
                onClick={() => onSelect(s.id)}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}