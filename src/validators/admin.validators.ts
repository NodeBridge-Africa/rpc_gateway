import { param } from "express-validator";
import { body } from "express-validator";
import Joi from "joi";

// Schema for validating the request body when updating an App's details
export const appUpdateValidationRules = [
  param("appId").isMongoId().withMessage("Invalid App ID format"),
  body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters"),
  body("description")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  body("userId")
    .optional()
    .isMongoId()
    .withMessage("Invalid User ID format for userId field"),
  body("chainName")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("chainName must be between 1 and 50 characters"),
  body("chainId")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("chainId must be between 1 and 50 characters"),
  body("maxRps")
    .optional()
    .isInt({ min: 0 })
    .withMessage("maxRps must be a non-negative integer"),
  body("dailyRequestsLimit")
    .optional()
    .isInt({ min: 0 })
    .withMessage("dailyRequestsLimit must be a non-negative integer"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  body("apiKey")
    .optional()
    .isUUID(4)
    .withMessage("apiKey must be a valid UUID v4"),
  body("requests")
    .optional()
    .isInt({ min: 0 })
    .withMessage("requests must be a non-negative integer"),
  body("dailyRequests")
    .optional()
    .isInt({ min: 0 })
    .withMessage("dailyRequests must be a non-negative integer"),
  body("lastResetDate")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("lastResetDate must be a valid ISO 8601 date"),
  body().custom((value, { req }) => {
    const validKeys = Object.keys(req.body).filter(
      (key) => req.body[key] !== undefined
    );
    if (validKeys.length === 0) {
      throw new Error(
        "Request body cannot be empty and must contain at least one valid field for update."
      );
    }
    return true;
  }),
];

export const userUpdateValidationRules = [
  param("userId").isMongoId().withMessage("Invalid User ID format"),
  body("email")
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage("Invalid email format"),
  body("password")
    .optional()
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  body().custom((value, { req }) => {
    const validKeys = Object.keys(req.body).filter(
      (key) => req.body[key] !== undefined
    );
    if (validKeys.length === 0) {
      throw new Error(
        "Request body cannot be empty and must contain at least one valid field for update."
      );
    }
    return true;
  }),
];
