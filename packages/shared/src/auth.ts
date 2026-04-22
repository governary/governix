import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "operator", "viewer"]);
export const userStatusSchema = z.enum(["active", "inactive"]);

export const loginRequestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8)
});

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: userRoleSchema,
  status: userStatusSchema
});

export const sessionPayloadSchema = publicUserSchema.extend({
  iat: z.number().optional(),
  exp: z.number().optional()
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type SessionPayload = z.infer<typeof publicUserSchema>;

