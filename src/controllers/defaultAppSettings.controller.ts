import { Request, Response } from 'express';
import DefaultAppSettings, { IDefaultAppSettings } from '../models/defaultAppSettings.model';
import { successResponse, errorResponse } from '../utils/responseHandler';

// Define a constant for the settings document ID if we choose to use a fixed one.
// This helps ensure we're always working with the same single document.
// However, a simpler approach for a singleton is to just findOne and create if not exists.
// Let's use the simpler approach: always findOne(). If null, create a new one on update.

export class DefaultAppSettingsController {
  /**
   * Retrieves the global default application settings.
   * If no settings document exists, it creates one with predefined initial values.
   * @param req Express request object.
   * @param res Express response object.
   */
  public async getDefaultAppSettings(req: Request, res: Response): Promise<void> {
    try {
      let settings = await DefaultAppSettings.findOne();
      if (!settings) {
        // If no settings document exists, create one with initial safe defaults.
        // This ensures that there's always a settings document available after this endpoint is hit once.
        settings = await DefaultAppSettings.create({
          defaultMaxRps: 20, // Initial safe default for max RPS
          defaultDailyRequestsLimit: 10000 // Initial safe default for daily requests limit
        });
        successResponse(res, 200, 'Default app settings retrieved (initial defaults created).', { settings });
        return;
      }
      successResponse(res, 200, 'Default app settings retrieved successfully.', { settings });
    } catch (error) {
      console.error('Error getting default app settings:', error);
      errorResponse(res, 500, 'Internal server error.', { details: (error as Error).message });
    }
  }

  /**
   * Updates the global default application settings.
   * If no settings document exists, it creates one (upsert behavior).
   * @param req Express request object, expects { defaultMaxRps, defaultDailyRequestsLimit } in body.
   * @param res Express response object.
   */
  public async updateDefaultAppSettings(req: Request, res: Response): Promise<void> {
    try {
      const { defaultMaxRps, defaultDailyRequestsLimit } = req.body;

      // Basic validation for presence and type
      if (typeof defaultMaxRps !== 'number' || typeof defaultDailyRequestsLimit !== 'number') {
        errorResponse(res, 400, 'Both defaultMaxRps and defaultDailyRequestsLimit must be numbers and are required.');
        return;
      }
      // Validation for non-negative values
      if (defaultMaxRps < 0 || defaultDailyRequestsLimit < 0) {
         errorResponse(res, 400, 'Values for defaultMaxRps and defaultDailyRequestsLimit cannot be negative.');
         return;
      }

      // Use findOneAndUpdate with upsert:true to update the existing document
      // or create a new one if it doesn't exist. This ensures a single settings document.
      // An empty filter {} targets the single document (if it exists) or provides a base for creation.
      const updatedSettings = await DefaultAppSettings.findOneAndUpdate(
        {}, 
        { defaultMaxRps, defaultDailyRequestsLimit },
        { new: true, upsert: true, runValidators: true }
      );

      successResponse(res, 200, 'Default app settings updated successfully.', { settings: updatedSettings });
    } catch (error) {
      console.error('Error updating default app settings:', error);
      if ((error as any).name === 'ValidationError') {
         errorResponse(res, 400, 'Validation error.', { details: (error as Error).message });
      } else {
         errorResponse(res, 500, 'Internal server error.', { details: (error as Error).message });
      }
    }
  }
}
