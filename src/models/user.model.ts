import { Schema, model, Document } from "mongoose";
import bcrypt from "bcrypt";

export interface IUser extends Document {
  email: string; // User's email address, used for login
  password: string; // Hashed password for the user
  isActive: boolean; // Whether the user's account is currently active
  appCount: number; // Number of Applications (Apps) created by this user
  isAdmin: boolean; // Whether the user has administrative privileges
  createdAt: Date; // Timestamp of user creation
  updatedAt: Date; // Timestamp of last user update

  // Custom methods
  comparePassword(candidatePassword: string): Promise<boolean>; // Method to compare a candidate password with the stored hash
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
      minlength: 6, // Enforce a minimum password length
    },
    isActive: {
      type: Boolean,
      default: true, // Users are active by default
    },
    appCount: {
      type: Number,
      default: 0, // Number of applications owned by the user
    },
    isAdmin: {
      type: Boolean,
      default: false, // Users are not admins by default
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
    toJSON: {
      // Transformation to remove password when converting document to JSON
      transform: function (doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

// Mongoose pre-save hook to hash password before saving a new user or when password is modified.
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

// Instance method to compare a candidate password with the user's hashed password.
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Note: Fields like apiKey, maxRps, requests, dailyRequests, lastResetDate,
// and methods like generateNewApiKey, resetDailyRequestsIfNeeded have been removed
// from the User model as these functionalities are now handled by the App model.

export default model<IUser>("User", UserSchema);
