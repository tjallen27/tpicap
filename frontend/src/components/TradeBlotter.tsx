import { useMemo, useEffect, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import type { ColDef, GridApi, IRowNode, ValueGetterParams, ValueFormatterParams, RowClassParams } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);
import type { Trade } from '@tpicap/shared';
import { TradeActions } from './TradeActions';
import { usePrices } from '../hooks/usePrices';
import { calculatePnl } from '../lib/pnl';
import { formatCurrency, formatPrice, formatTimestamp, formatQuantity } from '../lib/formatters';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface TradeBlotterProps {
  trades: Trade[];
  onAmend: (trade: Trade) => void;
  onCancel: (trade: Trade) => void;
  filtered: boolean;
}

export function TradeBlotter({ trades, onAmend, onCancel, filtered }: TradeBlotterProps) {
  const prices = usePrices();
  const gridApiRef = useRef<GridApi | null>(null);
  const prevPricesRef = useRef<Record<string, number>>({});
  const priceDirectionsRef = useRef<Record<string, 'up' | 'down'>>({});

  useEffect(() => {
    const directions: Record<string, 'up' | 'down'> = {};
    for (const [symbol, price] of Object.entries(prices)) {
      const prev = prevPricesRef.current[symbol];
      if (prev !== undefined && price !== prev) {
        directions[symbol] = price > prev ? 'up' : 'down';
      }
    }
    prevPricesRef.current = prices;

    if (!gridApiRef.current) return;
    const api = gridApiRef.current;

    const affectedNodes: IRowNode<Trade>[] = [];
    api.forEachNode(node => {
      if (node.data && directions[node.data.symbol]) affectedNodes.push(node);
    });

    priceDirectionsRef.current = directions;
    if (affectedNodes.length > 0) api.redrawRows({ rowNodes: affectedNodes });

    // Also refresh P&L values for updated prices
    api.refreshCells({ columns: ['pnl'], force: true });

    const timer = setTimeout(() => {
      priceDirectionsRef.current = {};
      if (affectedNodes.length > 0) api.redrawRows({ rowNodes: affectedNodes });
    }, 800);

    return () => clearTimeout(timer);
  }, [prices]);

  const columnDefs = useMemo<ColDef<Trade>[]>(() => [
    { field: 'id', headerName: 'Trade ID' },
    { field: 'symbol', headerName: 'Symbol' },
    {
      field: 'side',
      headerName: 'Side',
      cellClass: (p) => p.value === 'BUY' ? 'buy-cell' : 'sell-cell',
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      valueFormatter: (p: ValueFormatterParams<Trade, number>) =>
        p.value != null ? formatQuantity(p.value) : '',
    },
    {
      field: 'price',
      headerName: 'Price',
      valueFormatter: (p: ValueFormatterParams<Trade, number>) =>
        p.value != null ? formatPrice(p.value) : '',
    },
    { field: 'trader', headerName: 'Trader' },
    { field: 'book', headerName: 'Book' },
    { field: 'counterparty', headerName: 'Counterparty' },
    {
      field: 'tradeTimestamp',
      headerName: 'Timestamp',
      valueFormatter: (p: ValueFormatterParams<Trade, string>) =>
        p.value ? formatTimestamp(p.value) : '',
    },
    {
      field: 'status',
      headerName: 'Status',
      cellClass: (p) => p.value === 'CANCELLED' ? 'status-cancelled' : 'status-active',
    },
    {
      colId: 'pnl',
      headerName: 'P&L',
      valueGetter: (p: ValueGetterParams<Trade>) => {
        if (!p.data) return null;
        const current = prices[p.data.symbol] ?? p.data.price;
        return calculatePnl(p.data, current);
      },
      valueFormatter: (p: ValueFormatterParams<Trade, number>) =>
        p.value != null ? formatCurrency(p.value) : '',
      cellClass: (p) =>
        p.value > 0 ? 'pnl-positive' : p.value < 0 ? 'pnl-negative' : 'pnl-neutral',
    },
    {
      colId: 'actions',
      headerName: 'Actions',
      sortable: false,
      cellRenderer: 'TradeActions',
    },
  ], [prices]);

  const context = useMemo(() => ({ onAmend, onCancel }), [onAmend, onCancel]);

  const getRowClass = (p: RowClassParams<Trade>) => {
    const classes: string[] = [];
    if (p.data?.status === 'CANCELLED') classes.push('row-cancelled');
    if (p.data) {
      const dir = priceDirectionsRef.current[p.data.symbol];
      if (dir) classes.push(`price-flash-${dir}`);
    }
    return classes.length > 0 ? classes : undefined;
  };

  return (
    <div data-testid="ag-grid-wrapper" className="ag-theme-alpine">
      {trades.length === 0 && filtered ? (
        <div className="empty-filter-message">No trades match your search</div>
      ) : (
        <AgGridReact<Trade>
          rowData={trades}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true }}
          components={{ TradeActions }}
          context={context}
          getRowClass={getRowClass}
          animateRows={false}
          onGridReady={(e) => { gridApiRef.current = e.api; }}
          initialState={{
            sort: {
              sortModel: [{ colId: 'tradeTimestamp', sort: 'desc' }],
            },
          }}
        />
      )}
    </div>
  );
}
