import { z } from 'zod';

const answerSchema = z.object({
  question: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  scale: z.string().optional()
});

const rowSchema = z.object({
  submitted_at: z.union([z.string(), z.date()]).optional(),
  company: z.string().min(1),
  department: z.string().min(1),
  answers: z.array(answerSchema).default([])
});

export const ingestBatchSchema = z.object({
  survey_run_id: z.number().int().positive().optional(),
  rows: z.array(rowSchema).min(1)
});

export const ingestSingleSchema = rowSchema;
