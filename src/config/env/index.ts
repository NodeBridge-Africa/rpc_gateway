import dotenv from "dotenv";
import Joi from "joi"; // Import Joi
import { schema as baseSchema } from "./schema"; // Assuming this is the base schema for non-chain vars
import { Validate } from "./validators"; // Assuming this is a Joi validation helper
import { ConfigTypes, AllChainConfigs, ChainConfig } from "../types";

dotenv.config();

// --- Dynamic Chain Configuration Logic ---
const allChainConfigs: AllChainConfigs = {};
const chainNames = new Set<string>();
const chainVarSuffixes = [
  "_EXECUTION_RPC_URL",
  "_CONSENSUS_API_URL",
  "_PROMETHEUS_URL",
];

// Discover chain names by looking for specific env var suffixes
for (const key in process.env) {
  for (const suffix of chainVarSuffixes) {
    if (key.endsWith(suffix)) {
      const chain = key.replace(suffix, "");
      if (chain && !chain.startsWith("DEFAULT_")) { // Avoid picking up legacy/default vars if any
        chainNames.add(chain.toUpperCase());
      }
      break; 
    }
  }
}

// For each discovered chain, validate and store its configuration
chainNames.forEach(chainName => {
  const chainSpecificSchema = Joi.object({
    [`${chainName}_EXECUTION_RPC_URL`]: Joi.string().uri().optional(),
    [`${chainName}_CONSENSUS_API_URL`]: Joi.string().uri().optional(),
    [`${chainName}_PROMETHEUS_URL`]: Joi.string().uri().optional(),
  }).unknown(true); // Allow other env vars

  const { error, value: chainEnvVars } = chainSpecificSchema.validate(process.env, { stripUnknown: false });
  if (error) {
    // Log warning or handle as per project's error strategy for optional chain configs
    console.warn(`Validation error for chain ${chainName} config: ${error.message}`);
    allChainConfigs[chainName.toLowerCase()] = {}; // Store empty if validation fails or no vars
  } else {
    allChainConfigs[chainName.toLowerCase()] = {
      executionRpcUrl: chainEnvVars[`${chainName}_EXECUTION_RPC_URL`],
      consensusApiUrl: chainEnvVars[`${chainName}_CONSENSUS_API_URL`],
      prometheusUrl: chainEnvVars[`${chainName}_PROMETHEUS_URL`],
    };
  }
});

export function getChainConfig(chainName: string): ChainConfig | undefined {
  return allChainConfigs[chainName.toLowerCase()];
}

// --- Original Config Validation (for non-chain specific vars) ---
// Assuming 'schema' from './schema' defines PORT, JWT_SECRET etc.
// And does NOT define the old EXECUTION_RPC_URL, CONSENSUS_API_URL, PROMETHEUS_URL
const { error: baseError, value: baseEnvVariables } = Validate(baseSchema).validate(
  process.env
);

if (baseError) {
  throw new Error(`Base config validation error: ${baseError.message}`);
}

export const config: ConfigTypes = {
  PORT: baseEnvVariables.PORT,
  JWT_SECRET: baseEnvVariables.JWT_SECRET,
  allChainConfigs,
  getChainConfig,
  // The following are removed as per task, assuming they were in baseSchema
  // PROMETHEUS_URL: baseEnvVariables.PROMETHEUS_URL, // To be removed from schema.ts
  // EXECUTION_RPC_URL: baseEnvVariables.EXECUTION_RPC_URL, // To be removed from schema.ts
  // CONSENSUS_API_URL: baseEnvVariables.CONSENSUS_API_URL, // To be removed from schema.ts
};
