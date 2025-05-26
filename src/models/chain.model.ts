import mongoose, { Document, Schema } from 'mongoose';

export interface IChain extends Document {
  chainName: string;
  chainId: string;
  isEnabled: boolean;
  description?: string;
}

const ChainSchema: Schema<IChain> = new Schema(
  {
    chainName: { type: String, unique: true, required: true },
    chainId: { type: String, unique: true, required: true },
    isEnabled: { type: Boolean, default: true },
    description: { type: String },
  },
  { timestamps: true }
);

const Chain = mongoose.model<IChain>('Chain', ChainSchema);
export default Chain;
