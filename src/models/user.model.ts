import { Schema, model, Document } from "mongoose";
import { v4 as uuid } from "uuid";
import bcrypt from "bcrypt";

export interface IUser extends Document {
  email: string;
  password: string;
  apiKey: string;
  maxRps: number; // rate-limit (requests / second)
  requests: number; // total count
  dailyRequests: number; // daily request count
  lastResetDate: Date; // for daily limit reset
  isActive: boolean; // account status
  createdAt: Date;
  updatedAt: Date;

  // Custom methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  resetDailyRequestsIfNeeded(): void;
  generateNewApiKey(): string;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    apiKey: {
      type: String,
      default: uuid,
      unique: true,
      index: true,
    },
    maxRps: {
      type: Number,
      default: () => parseInt(process.env.DEFAULT_MAX_RPS || "20"),
    },
    requests: {
      type: Number,
      default: 0,
      min: 0,
    },
    dailyRequests: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastResetDate: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Reset daily requests if needed
UserSchema.methods.resetDailyRequestsIfNeeded = function () {
  const now = new Date();
  const lastReset = new Date(this.lastResetDate);

  // Reset if it's a new day
  if (
    now.getDate() !== lastReset.getDate() ||
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear()
  ) {
    this.dailyRequests = 0;
    this.lastResetDate = now;
  }
};

// Generate new API key
UserSchema.methods.generateNewApiKey = function () {
  this.apiKey = uuid();
  return this.apiKey;
};

export default model<IUser>("User", UserSchema);
