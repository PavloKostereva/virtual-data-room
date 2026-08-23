import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80, "Name is too long."),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter a 6-digit code.");

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: resetCodeSchema,
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password is required."),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Choose a password that is different from the current one.",
    path: ["newPassword"],
  });

export const itemNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(255, "Name is too long.");

export const createDataRoomSchema = z.object({
  name: itemNameSchema,
  description: z.string().trim().max(500, "Description is too long.").optional(),
});

export const updateDataRoomSchema = z
  .object({
    name: itemNameSchema.optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => value.name !== undefined || value.description !== undefined, {
    message: "Nothing to update.",
  });

export const createFolderSchema = z.object({
  parentId: z.string().min(1),
  name: itemNameSchema,
});

export const conflictStrategySchema = z.enum(["fail", "rename", "version"]);

export const updateFolderSchema = z
  .object({
    name: itemNameSchema.optional(),
    parentId: z.string().min(1).optional(),
  })
  .refine((value) => value.name !== undefined || value.parentId !== undefined, {
    message: "Nothing to update.",
  });

export const updateFileSchema = z
  .object({
    name: itemNameSchema.optional(),
    folderId: z.string().min(1).optional(),
    conflictStrategy: conflictStrategySchema.default("fail"),
  })
  .refine((value) => value.name !== undefined || value.folderId !== undefined, {
    message: "Nothing to update.",
  });

export const uploadTicketSchema = z.object({
  folderId: z.string().min(1),
  fileName: itemNameSchema,
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
});

export const finalizeUploadSchema = z.object({
  folderId: z.string().min(1),
  fileName: itemNameSchema,
  mimeType: z.string().min(1),
  storageKey: z.string().min(1),
  conflictStrategy: conflictStrategySchema.default("fail"),
});

export const listQuerySchema = z.object({
  sort: z.enum(["name", "updatedAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  shareToken: z.string().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().default(""),
  kind: z.enum(["all", "file", "folder"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  shareToken: z.string().optional(),
});

export const shareSubjectSchema = z.object({
  subjectType: z.enum(["DATA_ROOM", "FOLDER", "FILE"]),
  subjectId: z.string().min(1),
});

export const createShareSchema = shareSubjectSchema.extend({
  mode: z.enum(["PUBLIC_LINK", "RESTRICTED"]),
  emails: z.array(emailSchema).max(50, "You can invite up to 50 people at a time.").optional(),
  /** Viewer = read-only; Editor = can upload / rename / move within the shared item. */
  role: z.enum(["VIEWER", "EDITOR"]).default("VIEWER"),
  expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]).nullable().optional(),
});

export const toggleStarSchema = z.object({
  subjectType: z.enum(["FILE", "FOLDER"]),
  subjectId: z.string().min(1),
});

export const restoreTrashSchema = z.object({
  kind: z.enum(["file", "folder", "dataRoom"]),
  id: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateDataRoomInput = z.infer<typeof createDataRoomSchema>;
