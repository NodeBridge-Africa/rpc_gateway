export interface ChainConfig {
  executionRpcUrl?: string[];
  consensusApiUrl?: string[];
  prometheusUrl?: string[];
}

export interface AllChainConfigs {
  [chainName: string]: ChainConfig;
}

export type ConfigTypes = {
  MONGO_URI: string;
  PORT: number;
  JWT_SECRET: string;
  allChainConfigs: AllChainConfigs;
  getChainConfig: (chainName: string) => ChainConfig | undefined;
};
