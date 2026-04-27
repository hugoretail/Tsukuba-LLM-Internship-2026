import { z } from "zod";

export const directionSchema = z.enum(["fr-ja", "ja-fr"]);

export const translateRequestSchema = z.object({
  text: z.string().trim().min(1, "text is required"),
  direction: directionSchema,
});

export const translateLlmOutputSchema = z.object({
  natural: z.string().trim().min(1),
  literal: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  hints: z.array(z.string().trim().min(1)).min(2).max(4),
});

export type Direction = z.infer<typeof directionSchema>;
export type TranslateRequest = z.infer<typeof translateRequestSchema>;
export type TranslateLlmOutput = z.infer<typeof translateLlmOutputSchema>;
