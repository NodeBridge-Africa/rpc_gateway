import dotenv from "dotenv";
import Joi from "joi"; // Import Joi
import { schema as baseSchema } from "./schema"; // Assuming this is the base schema for non-chain vars
import { Validate } from "./validators"; // Assuming this is a Joi validation helper
import { ConfigTypes, AllChainConfigs, ChainConfig } from "../types";

dotenv.config();

// --- Dynamic Chain Configuration Logic ---
const allChainConfigs: AllChainConfigs = {};
const chainNames = new Map<string, string>(); // Map from lowercase chain name to original case
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
      // Exclude DEFAULT prefixed variables and ensure chain name is not empty
      if (chain && chain !== "DEFAULT") {
        chainNames.set(chain.toLowerCase(), chain); // Store original case
      }
      break;
    }
  }
}

// For each discovered chain, validate and store its configuration
chainNames.forEach((originalChainName, lowerChainName) => {
  const chainSpecificSchema = Joi.object({
    [`${originalChainName}_EXECUTION_RPC_URL`]: Joi.string()
      .allow("")
      .optional(),
    [`${originalChainName}_CONSENSUS_API_URL`]: Joi.string()
      .allow("")
      .optional(),
    [`${originalChainName}_PROMETHEUS_URL`]: Joi.string()
      .custom((value, helpers) => {
        // Allow comma-separated list of URIs
        const urls = value.split(",").map((url: string) => url.trim());
        for (const url of urls) {
          if (!Joi.attempt(url, Joi.string().uri())) {
            return helpers.error("any.invalid");
          }
        }
        return value;
      }, "Comma-separated URI validation")
      .optional(),
  }).unknown(true); // Allow other env vars

  const { error, value: chainEnvVars } = chainSpecificSchema.validate(
    process.env,
    { stripUnknown: false }
  );
  if (error) {
    // Log warning or handle as per project's error strategy for optional chain configs
    console.warn(
      `Validation error for chain ${originalChainName} config: ${error.message}`
    );
    allChainConfigs[lowerChainName] = {}; // Store empty if validation fails or no vars
  } else {
    const rawExecUrl = chainEnvVars[`${originalChainName}_EXECUTION_RPC_URL`];
    const executionRpcUrl = rawExecUrl
      ? rawExecUrl
          .split(",")
          .map((url: string) => url.trim())
          .filter((url: string) => url)
      : undefined;

    const rawConsensusApiUrl =
      chainEnvVars[`${originalChainName}_CONSENSUS_API_URL`];
    const consensusApiUrl = rawConsensusApiUrl
      ? rawConsensusApiUrl
          .split(",")
          .map((url: string) => url.trim())
          .filter((url: string) => url)
      : undefined;

    const rawPrometheusUrl =
      chainEnvVars[`${originalChainName}_PROMETHEUS_URL`];
    const prometheusUrl = rawPrometheusUrl
      ? rawPrometheusUrl
          .split(",")
          .map((url: string) => url.trim())
          .filter((url: string) => url)
      : undefined;

    allChainConfigs[lowerChainName] = {
      executionRpcUrl:
        executionRpcUrl && executionRpcUrl.length > 0
          ? executionRpcUrl
          : undefined,
      consensusApiUrl:
        consensusApiUrl && consensusApiUrl.length > 0
          ? consensusApiUrl
          : undefined,
      prometheusUrl:
        prometheusUrl && prometheusUrl.length > 0 ? prometheusUrl : undefined,
    };
  }
});

export function getChainConfig(chainName: string): ChainConfig | undefined {
  return allChainConfigs[chainName.toLowerCase()];
}

function buildConfig(): ConfigTypes {
  const { error, value: baseEnvVariables } = Validate(baseSchema).validate(
    process.env
  );
  if (error) {
    throw new Error(`Base config validation error: ${error.message}`);
  }
  return {
    MONGO_URI: baseEnvVariables.MONGO_URI,
    PORT: baseEnvVariables.PORT,
    JWT_SECRET: baseEnvVariables.JWT_SECRET,
    allChainConfigs,
    getChainConfig,
  };
}

export const config = buildConfig();
