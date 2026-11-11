import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Trade } from '@tpicap/shared';
import { amendTrade, ApiError } from '../api/trades';

const FormSchema = z.object({
  quantity: z.number().int().positive('Must be a positive integer'),
  price: z.number().positive('Must be a positive number'),
  trader: z.string(),
  book: z.string(),
  counterparty: z.string(),
});

type FormValues = z.infer<typeof FormSchema>;

interface AmendTradeFormProps {
  trade: Trade;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AmendTradeForm({ trade, onClose, onSuccess }: AmendTradeFormProps) {
  const [notification, setNotification] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      quantity: trade.quantity,
      price: trade.price,
      trader: trade.trader,
      book: trade.book,
      counterparty: trade.counterparty,
    },
  });

  const values = useWatch({ control });
  const hasChanges =
    values.quantity !== trade.quantity ||
    values.price !== trade.price ||
    values.trader !== trade.trader ||
    values.book !== trade.book ||
    values.counterparty !== trade.counterparty;

  const mutation = useMutation({
    mutationFn: (data: FormValues) => amendTrade(trade.id, data),
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setNotification('This trade has been cancelled and cannot be amended.');
        queryClient.invalidateQueries({ queryKey: ['trades'] });
        onClose();
      } else {
        setNotification('Failed to amend trade. Please try again.');
      }
    },
  });

  const onSubmit = handleSubmit(data => {
    setNotification(null);
    mutation.mutate(data);
  });

  return (
    <div className="form-panel">
      <h2>Amend Trade</h2>

      {notification && <p className="form-notification">{notification}</p>}

      <form onSubmit={onSubmit}>
        <div>
          <label htmlFor="amend-quantity">Quantity</label>
          <input
            id="amend-quantity"
            type="number"
            {...register('quantity', { valueAsNumber: true })}
          />
          {errors.quantity && <span>{errors.quantity.message}</span>}
        </div>

        <div>
          <label htmlFor="amend-price">Price</label>
          <input
            id="amend-price"
            type="number"
            step="0.01"
            {...register('price', { valueAsNumber: true })}
          />
          {errors.price && <span>{errors.price.message}</span>}
        </div>

        <div>
          <label htmlFor="amend-trader">Trader</label>
          <input id="amend-trader" {...register('trader')} />
          {errors.trader && <span>{errors.trader.message}</span>}
        </div>

        <div>
          <label htmlFor="amend-book">Book</label>
          <input id="amend-book" {...register('book')} />
          {errors.book && <span>{errors.book.message}</span>}
        </div>

        <div>
          <label htmlFor="amend-counterparty">Counterparty</label>
          <input id="amend-counterparty" {...register('counterparty')} />
          {errors.counterparty && <span>{errors.counterparty.message}</span>}
        </div>

        <div>
          <button type="submit" disabled={!hasChanges || isSubmitting || mutation.isPending}>
            Submit
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </form>
    </div>
  );
}
