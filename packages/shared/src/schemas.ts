import { z } from 'zod';
import {
  MAINTENANCE_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  USER_ROLES,
} from './constants.js';

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const createBuildingSchema = z.object({
  name: z.string().trim().min(2, 'Building name is required').max(120),
  code: z
    .string()
    .trim()
    .min(2, 'Building code is required')
    .max(20)
    .toUpperCase(),
  description: z.string().trim().max(500).optional().default(''),
});

export const updateBuildingSchema = createBuildingSchema.partial().extend({
  active: z.boolean().optional(),
});

export const createRoomSchema = z.object({
  buildingId: z.string().trim().min(1, 'Building ID is required'),
  name: z.string().trim().min(1, 'Room name is required').max(120),
  roomNumber: z.string().trim().min(1, 'Room number is required').max(40),
  floor: z.string().trim().max(40).optional().default('Ground'),
});

export const updateRoomSchema = createRoomSchema.partial().extend({
  active: z.boolean().optional(),
});

export const aiDraftOutputSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(5).max(2000),
  suggestedCategory: z.enum(MAINTENANCE_CATEGORIES),
  transcript: z.string().trim().min(1).max(4000),
});

export const aiDraftStoredSchema = aiDraftOutputSchema.extend({
  model: z.string().trim().min(1),
  generatedAt: z.string().datetime(),
  isMock: z.boolean(),
});

export const createTicketSchema = z.object({
  clientSubmissionId: z.string().trim().min(8).max(128),
  buildingId: z.string().trim().min(1, 'Building is required'),
  roomId: z.string().trim().min(1, 'Room is required'),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(140),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(3000),
  category: z.enum(MAINTENANCE_CATEGORIES),
  aiDraft: aiDraftStoredSchema.optional().nullable(),
});

export const assignTicketSchema = z.object({
  assigneeId: z.string().trim().min(1, 'Technician is required'),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  expectedVersion: z.number().int().min(0),
});

export const updatePrioritySchema = z.object({
  priority: z.enum(TICKET_PRIORITIES),
  expectedVersion: z.number().int().min(0),
});

export const startWorkSchema = z.object({
  expectedVersion: z.number().int().min(0),
});

export const submitRepairSchema = z.object({
  completionNote: z
    .string()
    .trim()
    .min(3, 'Completion note must be at least 3 characters')
    .max(2000),
  expectedVersion: z.number().int().min(0),
});

export const closeTicketSchema = z.object({
  verificationNote: z.string().trim().max(1000).optional(),
  expectedVersion: z.number().int().min(0),
});

export const reopenTicketSchema = z.object({
  reason: z.string().trim().min(3, 'Reopen reason is required').max(1000),
  expectedVersion: z.number().int().min(0),
});

export const ticketQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.enum(MAINTENANCE_CATEGORIES).optional(),
  buildingId: z.string().trim().optional(),
  assigneeId: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const roleSchema = z.enum(USER_ROLES);

export const registerPushTokenSchema = z.object({
  token: z.string().trim().min(10, 'Push token is required').max(300),
  platform: z.enum(['android', 'ios', 'web']).default('android'),
});

export const unregisterPushTokenSchema = z.object({
  token: z.string().trim().min(10).max(300),
});
