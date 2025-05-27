import Joi from 'joi';

// Schema for validating the request body when updating an App's details
export const appUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).allow('').optional(),
  userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'MongoDB ObjectId').optional(),
  chainName: Joi.string().min(1).max(50).optional(),
  chainId: Joi.string().min(1).max(50).optional(),
  maxRps: Joi.number().integer().min(0).optional(),
  dailyRequestsLimit: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
  apiKey: Joi.string().uuid({ version: 'uuidv4' }).messages({'string.guid': 'apiKey must be a valid UUID v4'}).optional(),
  requests: Joi.number().integer().min(0).optional(),
  dailyRequests: Joi.number().integer().min(0).optional(),
  lastResetDate: Joi.date().iso().optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update.'
});

// Schema for validating the request body when updating a User's details
export const userUpdateSchema = Joi.object({
  email: Joi.string().email().optional(),
  // Password validation: min 8, max 128. Controller prevents empty string.
  password: Joi.string().min(8).max(128).optional(), 
  isActive: Joi.boolean().optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update.'
});
