import { z } from 'zod';

const toolCallSchema = z.object({
  name: z.string(),
  args: z.record(z.any()).optional(),
  result: z.any().optional()
});

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().nullable().optional(),
  toolCalls: z.array(toolCallSchema).optional()
});

export const askSchema = z.object({
  messages: z.array(messageSchema).min(1).max(50)
});
