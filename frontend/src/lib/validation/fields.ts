import { z } from "zod";

const emailFormat = z.email();
const PHONE = /^\+?[0-9()\-\s]{5,30}$/;

export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

/** Optional text: empty strings and missing values are normalised to null. */
export const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .nullish()
    .transform((value) => value || null);

export const requiredEmail = (label = "Email") =>
  requiredText(label, 254).refine((value) => emailFormat.safeParse(value).success, {
    message: "Enter a valid email address.",
  });

export const optionalEmail = (label = "Email") =>
  optionalText(label, 254).refine(
    (value) => value === null || emailFormat.safeParse(value).success,
    { message: "Enter a valid email address." },
  );

export const requiredPhone = (label = "Phone") =>
  requiredText(label, 30).regex(PHONE, `Enter a valid ${label.toLowerCase()}.`);

export const optionalPhone = (label = "Phone") =>
  optionalText(label, 30).refine((value) => value === null || PHONE.test(value), {
    message: `Enter a valid ${label.toLowerCase()}.`,
  });
