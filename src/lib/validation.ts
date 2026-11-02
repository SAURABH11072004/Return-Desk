/**
 * Request payload schemas. Shared by the API (authoritative) and the UI forms (for instant
 * feedback), so each rule is written exactly once.
 */
import { z } from "zod";
import { RESOLUTIONS, RETURN_REASONS, RETURN_STATUSES } from "@/lib/domain";

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Phone must be 7–20 digits, spaces, dashes or brackets")
  .nullable();

export const customerContactSchema = z
  .object({
    name: requiredText("Customer name", 120),
    email: z
      .string({ error: "Customer email is required" })
      .trim()
      .max(254, "Customer email is too long")
      .pipe(z.email("Customer email must be a valid email address")),
    phone: phone.optional(),
  })
  .strict();

const quantity = z
  .number({ error: "Quantity must be a whole number" })
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(999, "Quantity must be at most 999");

export const createReturnSchema = z
  .object({
    orderNumber: requiredText("Order number", 40).toUpperCase(),
    sku: requiredText("Item SKU", 64).toUpperCase(),
    quantity,
    reason: z.enum(RETURN_REASONS, {
      error: (issue) => (issue.input === undefined ? "Choose a reason for the return" : "Reason must be one of the listed reasons"),
    }),
    customer: customerContactSchema,
  })
  .strict();
export type CreateReturnInput = z.infer<typeof createReturnSchema>;

/** Corrections to a request that has not been decided yet. Status is changed via transitions. */
export const updateReturnSchema = z
  .object({
    orderNumber: createReturnSchema.shape.orderNumber.optional(),
    sku: createReturnSchema.shape.sku.optional(),
    quantity: quantity.optional(),
    reason: createReturnSchema.shape.reason.optional(),
    customer: customerContactSchema.partial().strict().optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    error: "Provide at least one field to update",
  });
export type UpdateReturnInput = z.infer<typeof updateReturnSchema>;

const money = z
  .number({ error: "Refund amount must be a number" })
  .positive("Refund amount must be greater than zero")
  .max(99_999_999.99, "Refund amount is too large")
  .multipleOf(0.01, "Refund amount can have at most 2 decimal places");

/** Shape of a status change. Resolution rules are checked separately (see resolutionIssues). */
export const transitionShapeSchema = z
  .object({
    to: z.enum(RETURN_STATUSES, { error: "`to` must be a valid status" }),
    resolution: z.enum(RESOLUTIONS, { error: "Resolution must be refund, replacement or store_credit" }).optional(),
    refundAmount: money.optional(),
  })
  .strict();
export type TransitionInput = z.infer<typeof transitionShapeSchema>;

export type FieldIssue = { path: string; message: string };

/** Flatten Zod issues to { path: "customer.email", message } — the same form the API returns. */
export function toFieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(body)",
    message: issue.message,
  }));
}

/**
 * Rule 2. Kept apart from the shape so the server can first report an illegal transition (409)
 * and only then complain about a missing resolution (422).
 */
export function resolutionIssues(input: TransitionInput): FieldIssue[] {
  if (input.to !== "approved") {
    return [
      ...(input.resolution !== undefined
        ? [{ path: "resolution", message: "A resolution can only be set when approving" }]
        : []),
      ...(input.refundAmount !== undefined
        ? [{ path: "refundAmount", message: "A refund amount can only be set when approving" }]
        : []),
    ];
  }
  if (input.resolution === undefined) {
    return [{ path: "resolution", message: "A resolution (refund, replacement or store credit) is required to approve" }];
  }
  if (input.resolution === "refund" && input.refundAmount === undefined) {
    return [{ path: "refundAmount", message: "A refund amount greater than zero is required for a refund" }];
  }
  if (input.resolution !== "refund" && input.refundAmount !== undefined) {
    return [{ path: "refundAmount", message: "A refund amount may only be recorded when the resolution is refund" }];
  }
  return [];
}

/** Full client-side check for the approve form: shape plus resolution rules. */
export const transitionSchema = transitionShapeSchema.superRefine((input, ctx) => {
  for (const issue of resolutionIssues(input)) {
    ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
  }
});

export const createNoteSchema = z
  .object({
    author: requiredText("Author", 80),
    body: requiredText("Note", 2000),
  })
  .strict();
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

// ---------------------------------------------------------------------------
// List query (?q=&status=&reason=&sort=&dir=&page=&pageSize=)
// ---------------------------------------------------------------------------

export const RETURN_SORT_FIELDS = ["createdAt", "updatedAt", "reference", "customerName", "status"] as const;
export type ReturnSortField = (typeof RETURN_SORT_FIELDS)[number];

/** Comma-separated multi-value param, e.g. status=open,in_review. Empty means "no filter". */
const csvOf = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z
    .string()
    .optional()
    .transform((raw) => (raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : []))
    .pipe(z.array(z.enum(values, { error: `${label} must be one of: ${values.join(", ")}` })));

export const listReturnsQuerySchema = z.object({
  q: z.string().trim().max(100, "Search must be at most 100 characters").optional().transform((v) => v || undefined),
  status: csvOf(RETURN_STATUSES, "status"),
  reason: csvOf(RETURN_REASONS, "reason"),
  sort: z.enum(RETURN_SORT_FIELDS, { error: `sort must be one of: ${RETURN_SORT_FIELDS.join(", ")}` }).default("createdAt"),
  dir: z.enum(["asc", "desc"], { error: "dir must be asc or desc" }).default("desc"),
  page: z.coerce.number({ error: "page must be a number" }).int().min(1, "page must be at least 1").default(1),
  pageSize: z.coerce.number({ error: "pageSize must be a number" }).int().min(1).max(100, "pageSize must be at most 100").default(20),
});
export type ListReturnsQuery = z.infer<typeof listReturnsQuerySchema>;

export const searchOrdersQuerySchema = z.object({
  q: z.string().trim().min(1, "q is required").max(100),
});
