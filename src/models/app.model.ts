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
  /** Max requests per second */
  maxRps: number;
  dailyRequestsLimit: number; // New field
  requests: number;
  dailyRequests: number;
  lastResetDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Method to reset daily requests
  resetDailyRequestsIfNeeded(): void;
  // Method to generate a new API key (can be static or instance)
  // generateNewApiKey(): string; // Or consider making this a static method or utility
}

const AppSchema = new Schema<IApp>(
  {
    name: { type: String, required: true },
    description: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
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
      /** Max requests per second */
      // Default will now come from DefaultAppSettings during app creation, not from schema default
    },
    dailyRequestsLimit: {
      type: Number,
      required: true,
      // Default will now come from DefaultAppSettings during app creation
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
AppSchema.methods.resetDailyRequestsIfNeeded = function () {
  const now = new Date();
  const lastReset = new Date(this.lastResetDate);

  if (
    now.getDate() !== lastReset.getDate() ||
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear()
  ) {
    this.dailyRequests = 0;
    this.lastResetDate = now;
  }
};

// Optional: If you want a method on the instance to regenerate a key (though less common for apps)
// AppSchema.methods.generateNewApiKey = function (): string {
//   this.apiKey = uuid();
//   return this.apiKey;
// };

// Index for querying apps by user
AppSchema.index({ userId: 1 });

export default model<IApp>("App", AppSchema);
