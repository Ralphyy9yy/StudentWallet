import { z } from "zod";
export const displayNameSchema = z
  .string()
  .trim()
  .max(60, "Use 60 characters or fewer.")
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/.test(value),
    "Use a single line for your name.",
  )
  .transform((value) => value || null);
