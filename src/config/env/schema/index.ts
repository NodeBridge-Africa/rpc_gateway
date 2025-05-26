import { Joi } from "celebrate";

// define validation for all the env vars
export const schema = {
  PORT: Joi.number().required(),
  JWT_SECRET: Joi.string().required(),
  // PROMETHEUS_URL: Joi.string().required(), // Removed: Handled by chain-specific config
  // EXECUTION_RPC_URL: Joi.string().required(), // Removed: Handled by chain-specific config
  // CONSENSUS_API_URL: Joi.string().required(), // Removed: Handled by chain-specific config
};
