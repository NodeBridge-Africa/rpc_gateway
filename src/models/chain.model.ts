import mongoose, { Document, Schema } from 'mongoose';

export interface IChain extends Document {
  chainName: string; // User-friendly name of the blockchain (e.g., "Ethereum Mainnet", "Sepolia Testnet")
  chainId: string; // The numerical chain ID (e.g., "1" for Mainnet, "11155111" for Sepolia)
  isEnabled: boolean; // Whether this chain is available for users to create Apps against
  description?: string; // Optional description for this chain (e.g., "Primary Ethereum test network")
}

const ChainSchema: Schema<IChain> = new Schema(
  {
    chainName: { type: String, unique: true, required: true, trim: true }, // Name of the blockchain, must be unique
    chainId: { type: String, unique: true, required: true, trim: true }, // Chain ID, must be unique
    isEnabled: { type: Boolean, default: true }, // Is this chain currently enabled for creating new Apps?
    description: { type: String }, // Optional administrator-provided description
  },
  { timestamps: true } // Adds createdAt and updatedAt timestamps
);

const Chain = mongoose.model<IChain>('Chain', ChainSchema);
export default Chain;
