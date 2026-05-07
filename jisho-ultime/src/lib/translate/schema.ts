import { z } from "zod";

export const directionSchema = z.enum(["fr-ja", "ja-fr"]);
export const uiLangSchema = z.enum(["fr", "ja"]);

const annotationTokenSchema = z.object({
  display: z.string().trim().min(1),
  surface: z.string().trim().min(1),
  gloss: z.string().trim().min(1),
  equivalents: z.array(z.string().trim().min(1)).min(1).max(4),
  lemma: z.string().trim().min(1).optional(),
  pos: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
});

const grammarPointSchema = z.object({
  name: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  line: z.number().int().nonnegative(),
  token_span: z
    .tuple([
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
    ])
    .optional(),
  example: z.string().trim().min(1).optional(),
});

export const translateRequestSchema = z.object({
  text: z.string().trim().min(1, "text is required"),
  direction: directionSchema,
  uiLang: uiLangSchema.default("fr"),
});

export const translateLlmOutputSchema = z.object({
  natural: z.string().trim().min(1),
  literal: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  hints: z.array(z.string().trim().min(1)).default([]),
  annotations: z.array(z.array(annotationTokenSchema)).default([]),
  grammar: z.array(grammarPointSchema).default([]),
});

export type Direction = z.infer<typeof directionSchema>;
export type UILang = z.infer<typeof uiLangSchema>;
export type TranslateRequest = z.infer<typeof translateRequestSchema>;
export type TranslateLlmOutput = z.infer<typeof translateLlmOutputSchema>;
export type AnnotationToken = z.infer<typeof annotationTokenSchema>;
export type GrammarPoint = z.infer<typeof grammarPointSchema>;
