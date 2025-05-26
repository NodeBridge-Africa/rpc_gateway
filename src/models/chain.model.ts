import { Schema, model, Document } from "mongoose";

// Interface for the Chain document
export interface IChain extends Document {
  name: string; // e.g., "Sepolia", "Ethereum Mainnet"
  chainId: string; // e.g., "11155111", "1"
  isEnabled: boolean;
  adminNotes?: string; // Optional notes for admins
  createdAt: Date;
  updatedAt: Date;
}

const ChainSchema = new Schema<IChain>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    chainId: { type: String, required: true, unique: true, trim: true },
    isEnabled: { type: Boolean, default: true },
    adminNotes: { type: String },
  },
  {
    timestamps: true,
  }
);

// Index for quickly finding chains by name or chainId
ChainSchema.index({ name: 1 });
ChainSchema.index({ chainId: 1 });

export default model<IChain>("Chain", ChainSchema);
