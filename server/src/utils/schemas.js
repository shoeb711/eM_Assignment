// Reusable validation rules (zod) shared by the routes.
import { z } from 'zod';

export const id = z.coerce.number().int().positive();

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Not a real date');

// Money: positive, at most 2 decimal places, at most 100 million.
export const positiveMoney = z
  .number({ invalid_type_error: 'Amount must be a number' })
  .positive('Amount must be greater than zero')
  .max(100_000_000)
  .refine((v) => Number.isInteger(Math.round(v * 100)) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'At most 2 decimal places');

// The version the client last saw - used for optimistic locking.
export const version = z.number().int().positive();

export const text = (min, max) => z.string().trim().min(min).max(max);

// Query-string helpers (everything in a URL arrives as text)
export const optionalId = id.optional();
export const optionalBool = z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true'));
