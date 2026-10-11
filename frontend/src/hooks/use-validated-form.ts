"use client";

import { useCallback, useState } from "react";
import { z } from "zod";
import { ApiClientError } from "@/lib/api/client";

type FieldErrors = Partial<Record<string, string>>;

/**
 * Form state validated with the same Zod schema the API uses. `dirty` tracks
 * unsaved changes against the last `reset()` (drives ERPNext's "Not Saved").
 */
export function useValidatedForm<Input extends Record<string, unknown>, Output>(
  schema: z.ZodType<Output, Input>,
  initial: Input,
) {
  const [values, setValues] = useState<Input>(initial);
  const [baseline, setBaseline] = useState<Input>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  const setField = useCallback(<K extends keyof Input & string>(name: K, value: Input[K]) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
  }, []);

  const validate = useCallback((): Output | null => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return result.data;
    }
    const { fieldErrors } = z.flattenError(result.error);
    setErrors(
      Object.fromEntries(
        Object.entries(fieldErrors).map(([field, messages]) => [field, (messages as string[])[0]]),
      ),
    );
    return null;
  }, [schema, values]);

  /** Shows server-side field errors; returns true if any were applied. */
  const applyServerError = useCallback((error: unknown): boolean => {
    if (!(error instanceof ApiClientError)) return false;
    const entries = Object.entries(error.fieldErrors);
    if (entries.length === 0) return false;
    setErrors(Object.fromEntries(entries.map(([field, messages]) => [field, messages[0]])));
    return true;
  }, []);

  /** Replaces the values and marks them as saved. */
  const reset = useCallback((next: Input) => {
    setValues(next);
    setBaseline(next);
    setErrors({});
  }, []);

  const dirty = (Object.keys(values) as (keyof Input)[]).some(
    (key) => (values[key] ?? "") !== (baseline[key] ?? ""),
  );

  return { values, errors, dirty, setField, validate, applyServerError, reset };
}

export type ValidatedForm<Input extends Record<string, unknown>, Output> = ReturnType<
  typeof useValidatedForm<Input, Output>
>;
