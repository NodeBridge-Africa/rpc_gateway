import { Schema, model, Document } from "mongoose";

/**
 * Defines the structure for default application settings,
 * which are used as global defaults when new applications are created.
 */
export interface IDefaultAppSettings extends Document {
  /** Default maximum requests per second for new apps. */
  maxRps: number;
  /** Default maximum daily requests limit for new apps. */
  dailyRequestsLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

const DefaultAppSettingsSchema = new Schema<IDefaultAppSettings>(
  {
    maxRps: {
      type: Number,
      required: true,
      /** Default maximum requests per second for new apps. */
    },
    dailyRequestsLimit: {
      type: Number,
      required: true,
      /** Default maximum daily requests limit for new apps. */
    },
  },
  {
    timestamps: true,
  }
);

// Optional: To ensure only one instance of these settings can exist,
// you could use a unique index on a constant field, or manage via application logic.
// For simplicity with Mongoose, often application logic handles "singleton" models by always
// querying for a known ID or a document without specific criteria and creating if not found.
// Or, you can add a field like:
// settingsId: { type: String, default: 'global_app_settings', unique: true }
// And then always query for { settingsId: 'global_app_settings' }
// For now, let's keep it simple and the logic to manage a single doc will be in the controller.

export default model<IDefaultAppSettings>(
  "DefaultAppSettings",
  DefaultAppSettingsSchema
);
