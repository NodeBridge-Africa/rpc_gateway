import { Schema, model, Document } from 'mongoose';

export interface IDefaultAppSettings extends Document {
  defaultMaxRps: number;
  defaultDailyRequestsLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

const DefaultAppSettingsSchema = new Schema<IDefaultAppSettings>(
  {
    defaultMaxRps: { type: Number, required: true },
    defaultDailyRequestsLimit: { type: Number, required: true },
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

export default model<IDefaultAppSettings>('DefaultAppSettings', DefaultAppSettingsSchema);
