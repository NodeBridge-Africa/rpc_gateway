import dotenv from "dotenv";
import { schema } from "./schema";
import { Validate } from "./validators";
import { ConfigTypes } from "../types";
dotenv.config();

// validate environment variables
const envVarsSchema = Validate(schema);

const { error, value: envVariables } = envVarsSchema.validate(process.env);
if (error) throw new Error(`Config validation error: ${error.message}`);

export const config: ConfigTypes = {
  PORT: envVariables.PORT,
  JWT_SECRET: envVariables.JWT_SECRET,
  PROMETHEUS_URL: envVariables.PROMETHEUS_URL,
  EXECUTION_RPC_URL: envVariables.EXECUTION_RPC_URL,
  CONSENSUS_API_URL: envVariables.CONSENSUS_API_URL,
};
