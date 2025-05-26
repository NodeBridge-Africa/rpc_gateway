import { Joi } from "celebrate";

// define validation for all the env vars
export const schema = {
  PORT: Joi.number().required(),
  JWT_SECRET: Joi.string().required(),
  PROMETHEUS_URL: Joi.string().required(),
  EXECUTION_RPC_URL: Joi.string().required(),
  CONSENSUS_API_URL: Joi.string().required(),
};
