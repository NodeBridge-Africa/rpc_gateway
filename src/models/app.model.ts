import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_APP_MAX_RPS } from '../config/constants';

export interface IApp extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  apiKey: string;
  chainName: string;
  chainId: string;
  maxRps: number;
  requests: number;
  dailyRequests: number;
  lastResetDate: Date;
  isActive: boolean;
  resetDailyRequestsIfNeeded: () => Promise<void>;
}

const AppSchema: Schema<IApp> = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String },
    apiKey: { type: String, unique: true, indexed: true, default: uuidv4 },
    chainName: { type: String, required: true },
    chainId: { type: String, required: true },
    maxRps: { type: Number, default: DEFAULT_APP_MAX_RPS },
    requests: { type: Number, default: 0 },
    dailyRequests: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

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
