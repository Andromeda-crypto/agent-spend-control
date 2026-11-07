import { z } from 'zod';
export const ResearchInput = z.object({ topic: z.string().trim().min(3).max(500), mode: z.enum(['fixture','live']) }).strict();
