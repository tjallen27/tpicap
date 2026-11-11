import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import type { ColDef, ValueGetterParams, ValueFormatterParams, RowClassParams } from 'ag-grid-community';

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
      cellClass: (p) => {
        if (p.value > 0) return 'pnl-positive';
        if (p.value < 0) return 'pnl-negative';
        return 'pnl-neutral';
      },
    },
    {
      colId: 'actions',
      headerName: 'Actions',
      sortable: false,
      cellRenderer: 'TradeActions',
    },
  ], [prices]);

  const context = useMemo(() => ({ onAmend, onCancel }), [onAmend, onCancel]);

  const getRowClass = (p: RowClassParams<Trade>) =>
    p.data?.status === 'CANCELLED' ? 'row-cancelled' : undefined;

  return (
    <div data-testid="ag-grid-wrapper" className="ag-theme-alpine" style={{ height: 600 }}>
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
