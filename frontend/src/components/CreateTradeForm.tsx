import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { createTrade } from '../api/trades';

const toNumber = (val: unknown) =>
  val === '' || val === undefined ? undefined : Number(val);

const FormSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').max(10).transform(s => s.toUpperCase()),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.preprocess(toNumber, z.number().int().positive('Must be a positive integer').optional()),
  price: z.preprocess(toNumber, z.number().positive('Must be a positive number').optional()),
  trader: z.string(),
  book: z.string(),
  counterparty: z.string(),
});

type FormValues = z.infer<typeof FormSchema>;

interface CreateTradeFormProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateTradeForm({ onClose, onSuccess }: CreateTradeFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      side: 'BUY',
      trader: '',
      book: '',
      counterparty: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createTrade({
        symbol: values.symbol,
        side: values.side,
        quantity: values.quantity as number,
        price: values.price as number,
        trader: values.trader,
        book: values.book,
        counterparty: values.counterparty,
        tradeTimestamp: new Date().toISOString(),
      }),
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
    onError: () => {
      setErrorMessage('Failed to create trade. Please try again.');
    },
  });

  const onSubmit = handleSubmit(values => {
    setErrorMessage(null);
    mutation.mutate(values);
  });

  return (
    <div className="form-panel">
      <h2>Create Trade</h2>

      {errorMessage && <p className="form-error">{errorMessage}</p>}

      <form onSubmit={onSubmit}>
        <div>
          <label htmlFor="symbol">Symbol</label>
          <input id="symbol" {...register('symbol')} />
          {errors.symbol && <span>{errors.symbol.message}</span>}
        </div>

        <div>
          <label htmlFor="side">Side</label>
          <select id="side" {...register('side')}>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          {errors.side && <span>{errors.side.message}</span>}
        </div>

        <div>
          <label htmlFor="quantity">Quantity</label>
          <input id="quantity" type="number" {...register('quantity')} />
          {errors.quantity && <span>{errors.quantity.message}</span>}
        </div>

        <div>
          <label htmlFor="price">Price</label>
          <input id="price" type="number" step="0.01" {...register('price')} />
          {errors.price && <span>{errors.price.message}</span>}
        </div>

        <div>
          <label htmlFor="trader">Trader</label>
          <input id="trader" {...register('trader')} />
          {errors.trader && <span>{errors.trader.message}</span>}
        </div>

        <div>
          <label htmlFor="book">Book</label>
          <input id="book" {...register('book')} />
          {errors.book && <span>{errors.book.message}</span>}
        </div>

        <div>
          <label htmlFor="counterparty">Counterparty</label>
          <input id="counterparty" {...register('counterparty')} />
          {errors.counterparty && <span>{errors.counterparty.message}</span>}
        </div>

        <div>
          <button type="submit" disabled={isSubmitting || mutation.isPending}>
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
