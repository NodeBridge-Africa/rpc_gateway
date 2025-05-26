import { Request, Response } from 'express';
import DefaultAppSettings, { IDefaultAppSettings } from '../models/defaultAppSettings.model';
import { successResponse, errorResponse } from '../utils/responseHandler';

// Define a constant for the settings document ID if we choose to use a fixed one.
// This helps ensure we're always working with the same single document.
// However, a simpler approach for a singleton is to just findOne and create if not exists.
// Let's use the simpler approach: always findOne(). If null, create a new one on update.

export class DefaultAppSettingsController {
  public async getDefaultAppSettings(req: Request, res: Response): Promise<void> {
    try {
      let settings = await DefaultAppSettings.findOne();
      if (!settings) {
        // If no settings exist yet, return predefined initial defaults
        // or indicate that they need to be set.
        // For now, let's return null or a message, admin should set them.
        // Alternatively, create them here with some initial hardcoded values.
        // Let's opt to return a state indicating they're not set,
        // and the update method will be responsible for creation.
        // Or, better, create with initial safe defaults if not found.
        settings = await DefaultAppSettings.create({
          defaultMaxRps: 20, // Initial safe default
          defaultDailyRequestsLimit: 10000 // Initial safe default
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

  public async updateDefaultAppSettings(req: Request, res: Response): Promise<void> {
    try {
      const { defaultMaxRps, defaultDailyRequestsLimit } = req.body;

      if (typeof defaultMaxRps !== 'number' || typeof defaultDailyRequestsLimit !== 'number') {
        errorResponse(res, 400, 'Both defaultMaxRps and defaultDailyRequestsLimit must be numbers and are required.');
        return;
      }
      if (defaultMaxRps < 0 || defaultDailyRequestsLimit < 0) {
         errorResponse(res, 400, 'Values for defaultMaxRps and defaultDailyRequestsLimit cannot be negative.');
         return;
      }

      // Upsert logic: find and update, or create if not found.
      // findOneAndUpdate with upsert:true is perfect for this.
      const updatedSettings = await DefaultAppSettings.findOneAndUpdate(
        {}, // An empty filter object will match the first document found or be the basis for a new one
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
