import { z } from "zod";
import { isValidDate } from "./dates";
const id = z.string().min(1).max(100);
export const transactionCommandSchema = z
  .object({
    id: id.optional(),
    commandId: id.optional(),
    periodId: id,
    type: z.enum(["expense", "top_up"]),
    amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    categoryId: id.nullable().optional(),
    reserveId: id.nullable().optional(),
    occurredOn: z
      .string()
      .refine(isValidDate, "Enter a valid transaction date."),
    note: z.string().max(500).optional(),
  })
  .strict();
