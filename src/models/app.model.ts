import { Schema, model, Document, Types } from "mongoose";
import { v4 as uuid } from "uuid";

// Interface for the App document
export interface IApp extends Document {
  name: string;
  description?: string;
  userId: Types.ObjectId; // Reference to the User who owns the app
  apiKey: string;
  chainName: string;
  chainId: string;
  /** Max requests per second allowed for this app. */
  maxRps: number;
  /** The maximum number of requests the app can make per day. */
  dailyRequestsLimit: number;
  requests: number;
  dailyRequests: number;
  lastResetDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Method to reset daily requests
  resetDailyRequestsIfNeeded(): boolean;
  // Method to generate a new API key (can be static or instance)
  // generateNewApiKey(): string; // Or consider making this a static method or utility
}

const AppSchema = new Schema<IApp>(
  {
    name: { type: String, required: true },
    description: { type: String },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    apiKey: {
      type: String,
      default: () => uuid(), // Use a function to ensure fresh UUID on each new doc
      unique: true,
      index: true,
    },
    chainName: { type: String, required: true },
    chainId: { type: String, required: true },
    maxRps: {
      type: Number,
      required: true,
      /** Max requests per second allowed for this app. */
      // Default value is sourced from DefaultAppSettings during app creation.
    },
    dailyRequestsLimit: {
      type: Number,
      required: true,
      /** The maximum number of requests the app can make per day. */
      // Default value is sourced from DefaultAppSettings during app creation.
    },
    requests: { type: Number, default: 0, min: 0 },
    dailyRequests: { type: Number, default: 0, min: 0 },
    lastResetDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Method to reset daily requests
AppSchema.methods.resetDailyRequestsIfNeeded = function (this: IApp): boolean {
  const now = new Date();
  // Check if lastResetDate is null/undefined or if the date is different from today
  if (
    !this.lastResetDate ||
    this.lastResetDate.toDateString() !== now.toDateString()
  ) {
    this.dailyRequests = 0;
    this.lastResetDate = now;
    // console.log(`App ${this.name}: Daily requests reset to 0 for ${now.toDateString()}`);
    return true; // Reset occurred
  }
  return false; // No reset occurred
};

// Optional: If you want a method on the instance to regenerate a key (though less common for apps)
// AppSchema.methods.generateNewApiKey = function (): string {
//   this.apiKey = uuid();
//   return this.apiKey;
// };

// Index for querying apps by user
AppSchema.index({ userId: 1 });

export default model<IApp>("App", AppSchema);
