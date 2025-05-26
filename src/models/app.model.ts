import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_APP_MAX_RPS } from '../config/constants';

export interface IApp extends Document {
  userId: mongoose.Types.ObjectId; // Reference to the User who owns this App
  name: string; // User-defined name for the App
  description?: string; // Optional description for the App
  apiKey: string; // Unique API key generated for this App
  chainName: string; // Name of the blockchain this App connects to (e.g., "Ethereum Sepolia")
  chainId: string; // Chain ID of the blockchain (e.g., "11155111")
  maxRps: number; // Maximum requests per second allowed for this App's API key
  requests: number; // Total requests made using this App's API key (lifetime)
  dailyRequests: number; // Requests made using this App's API key in the current day
  lastResetDate: Date; // Timestamp of when dailyRequests was last reset
  isActive: boolean; // Whether this App and its API key are currently active
  resetDailyRequestsIfNeeded: () => Promise<void>; // Method to reset daily request counter
}

const AppSchema: Schema<IApp> = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // Indexed for faster queries by user
    name: { type: String, required: true },
    description: { type: String },
    apiKey: { type: String, unique: true, indexed: true, default: uuidv4 }, // API key for this specific application
    chainName: { type: String, required: true }, // Name of the blockchain (e.g., Ethereum Sepolia)
    chainId: { type: String, required: true }, // Chain ID (e.g., "11155111" for Sepolia)
    maxRps: { type: Number, default: DEFAULT_APP_MAX_RPS }, // Max requests per second for this app
    requests: { type: Number, default: 0 }, // Lifetime request count for this app
    dailyRequests: { type: Number, default: 0 }, // Daily request count for this app
    lastResetDate: { type: Date, default: Date.now }, // Tracks when dailyRequests was last reset
    isActive: { type: Boolean, default: true }, // App status (active/inactive)
  },
  { timestamps: true } // Adds createdAt and updatedAt timestamps
);

// Method to reset the dailyRequests counter if the current date is past the lastResetDate.
AppSchema.methods.resetDailyRequestsIfNeeded = async function (this: IApp) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (this.lastResetDate < today) {
    this.dailyRequests = 0;
    this.lastResetDate = today;
    await this.save();
  }
};

const App = mongoose.model<IApp>('App', AppSchema);
export default App;
