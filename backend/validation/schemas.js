const { z } = require('zod');

const email = z.string().trim().toLowerCase().max(150, 'Email too long').email('Invalid email');
const password = z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters');
const optText = (max) => z.string().trim().max(max, `Must be at most ${max} characters`).optional();
const optNullText = (max) => z.string().trim().max(max, `Must be at most ${max} characters`).nullable().optional();
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid id');
const roleEnum = z.enum(['student', 'faculty', 'admin']);
const fileTypeEnum = z.enum(['notes', 'paper', 'assignment', 'other']);

const register = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email,
  password,
  department: optText(100),
  year: optText(100),
  role: z.enum(['student', 'faculty']).optional(),
});

const login = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(200),
});

// accepts loginId / registerId / id, normalises to { id, code }
const verifyOtp = z
  .object({
    id: uuid.optional(),
    loginId: uuid.optional(),
    registerId: uuid.optional(),
    code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  })
  .refine((v) => v.id || v.loginId || v.registerId, { message: 'Missing verification id' })
  .transform((v) => ({ id: v.id || v.loginId || v.registerId, code: v.code }));

const resendOtp = z.object({ id: uuid });

const updateProfile = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(100).optional(),
  department: optNullText(100),
  year: optNullText(100),
});

const uploadFields = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  description: optText(2000),
  subject: optText(150),
  file_type: fileTypeEnum.optional(),
  department: optText(100),
  year: optText(100),
});

const filesQuery = z.object({
  dept: optText(100),
  year: optText(100),
  type: fileTypeEnum.optional(),
  search: optText(100),
  page: z.string().max(10).optional(),
  limit: z.string().max(10).optional(),
});

const createGroup = z.object({
  name: z.string().trim().min(3, 'Group name must be at least 3 characters').max(100),
  description: optText(2000),
  department: optText(100),
  is_private: z.boolean().optional(),
});

const joinByCode = z.object({ code: z.string().trim().min(4).max(12) });

const announcement = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  content: z.string().trim().min(1, 'Content is required').max(5000),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

const adminCreateUser = z.object({
  name: z.string().trim().min(1).max(100),
  email,
  password,
  role: roleEnum.optional(),
  department: optText(100),
  year: optText(100),
});

const adminUpdateUser = z.object({
  role: roleEnum.optional(),
  is_active: z.boolean().optional(),
  department: optText(100),
  year: optText(100),
});

const chatContent = z.string().trim().min(1).max(2000);

module.exports = {
  register, login, verifyOtp, resendOtp, updateProfile, uploadFields, filesQuery,
  createGroup, joinByCode, announcement, adminCreateUser, adminUpdateUser,
  chatContent, uuid,
};
