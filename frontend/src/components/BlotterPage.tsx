import { useState } from 'react';
import type { Trade } from '@tpicap/shared';
import { useTrades } from '../hooks/useTrades';
import { useWebSocket } from '../hooks/useWebSocket';
import { filterTrades } from '../lib/blotterPipeline';
import { TradeBlotter } from './TradeBlotter';
import { LoadingSkeleton } from './LoadingSkeleton';
import { FetchError } from './FetchError';
import { EmptyState } from './EmptyState';
import { ConnectionStatus } from './ConnectionStatus';
import { CreateTradeForm } from './CreateTradeForm';
import { AmendTradeForm } from './AmendTradeForm';
import { CancelConfirm } from './CancelConfirm';

const SIDE_OPTIONS = ['BUY', 'SELL'];
const STATUS_OPTIONS = ['ACTIVE', 'CANCELLED'];

export function BlotterPage() {
  const [search, setSearch] = useState('');
  const [sides, setSides] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [cancelTrade, setCancelTrade] = useState<Trade | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isSuccess, isError, isFetching, isRefetching, refetch } = useTrades();
  const { status: wsStatus, retry: wsRetry } = useWebSocket();

  const isFiltered = search !== '' || sides.length > 0 || statuses.length > 0;
  const filtered = filterTrades(data ?? [], search, sides, statuses);

  function clearFilters() {
    setSearch('');
    setSides([]);
    setStatuses([]);
  }

  function toggleSide(side: string) {
    setSides(prev =>
      prev.includes(side) ? prev.filter(s => s !== side) : [...prev, side],
    );
  }

  function toggleStatus(status: string) {
    setStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status],
    );
  }

  let content: React.ReactNode;
  if (isFetching && !data) {
    content = <LoadingSkeleton />;
  } else if (isError) {
    content = <FetchError onRetry={() => refetch()} />;
  } else if (isSuccess && data?.length === 0) {
    content = <EmptyState />;
  } else if (data) {
    content = (
      <TradeBlotter
        trades={filtered}
        onAmend={setSelectedTrade}
        onCancel={setCancelTrade}
        filtered={isFiltered}
      />
    );
  }

  return (
    <div className="blotter-page">
      <header className="blotter-header">
        <h1>Trade Blotter</h1>
        <ConnectionStatus status={wsStatus} onRetry={wsRetry} />

        <div className="blotter-controls">
          <input
            type="text"
            placeholder="Search trades…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <div className="filter-group">
            {SIDE_OPTIONS.map(side => (
              <label key={side}>
                <input
                  type="checkbox"
                  checked={sides.includes(side)}
                  onChange={() => toggleSide(side)}
                />
                {side}
              </label>
            ))}
          </div>

          <div className="filter-group">
            {STATUS_OPTIONS.map(status => (
              <label key={status}>
                <input
                  type="checkbox"
                  checked={statuses.includes(status)}
                  onChange={() => toggleStatus(status)}
                />
                {status}
              </label>
            ))}
          </div>

          <button onClick={clearFilters}>Clear filters</button>

          <button onClick={() => refetch()} disabled={isRefetching}>
            {isRefetching ? 'Refreshing…' : 'Refresh'}
          </button>

          <button onClick={() => setShowCreate(true)}>New Trade</button>
        </div>
      </header>

      <main>{content}</main>

      {showCreate && (
        <CreateTradeForm
          onClose={() => setShowCreate(false)}
          onSuccess={() => setShowCreate(false)}
        />
      )}

      {selectedTrade && (
        <AmendTradeForm
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onSuccess={() => setSelectedTrade(null)}
        />
      )}

      {cancelTrade && (
        <CancelConfirm
          trade={cancelTrade}
          onClose={() => setCancelTrade(null)}
          onSuccess={() => setCancelTrade(null)}
        />
      )}
    </div>
  );
}
