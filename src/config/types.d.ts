export interface ChainConfig {
  executionRpcUrl?: string[];
  consensusApiUrl?: string[];
  prometheusUrl?: string;
}

export interface AllChainConfigs {
  [chainName: string]: ChainConfig;
}

export type ConfigTypes = {
  MONGO_URI: string;
  PORT: number;
  JWT_SECRET: string;
  // These will be removed as they are replaced by chain-specific configs
  // PROMETHEUS_URL: string;
  // EXECUTION_RPC_URL: string;
  // CONSENSUS_API_URL: string;
  allChainConfigs: AllChainConfigs;
  getChainConfig: (chainName: string) => ChainConfig | undefined;
};
