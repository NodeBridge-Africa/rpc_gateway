import { ConfigTypes } from '../../src/config/types';

describe('Environment Configuration (src/config/env/index.ts)', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Reset Jest's module cache to allow re-importing src/config/env/index.ts
    jest.resetModules();
    // Backup original process.env
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv;
  });

  const loadConfig = async (): Promise<ConfigTypes> => {
    const { config } = await import('../../src/config/env');
    return config;
  };

  test('Test Case 1: Single URL for executionRpcUrl', async () => {
    process.env.TESTCHAIN_EXECUTION_RPC_URL = 'http://localhost:8545';
    process.env.TESTCHAIN_CONSENSUS_API_URL = ''; // Ensure chain is picked up
    const config = await loadConfig();
    const chainConfig = config.getChainConfig('testchain');
    expect(chainConfig?.executionRpcUrl).toEqual(['http://localhost:8545']);
  });

  test('Test Case 2: Multiple URLs for consensusApiUrl', async () => {
    process.env.TESTCHAIN_EXECUTION_RPC_URL = ''; // Ensure chain is picked up
    process.env.TESTCHAIN_CONSENSUS_API_URL = 'http://localhost:5052,http://localhost2:5052';
    const config = await loadConfig();
    const chainConfig = config.getChainConfig('testchain');
    expect(chainConfig?.consensusApiUrl).toEqual(['http://localhost:5052', 'http://localhost2:5052']);
  });

  test('Test Case 3: URLs with extra spaces for executionRpcUrl', async () => {
    process.env.TESTCHAIN_EXECUTION_RPC_URL = ' http://localhost:8545 , http://localhost2:8545 ';
    process.env.TESTCHAIN_CONSENSUS_API_URL = ''; // Ensure chain is picked up
    const config = await loadConfig();
    const chainConfig = config.getChainConfig('testchain');
    expect(chainConfig?.executionRpcUrl).toEqual(['http://localhost:8545', 'http://localhost2:8545']);
  });

  test('Test Case 4: Empty string for executionRpcUrl', async () => {
    process.env.TESTCHAIN_EXECUTION_RPC_URL = '';
    process.env.TESTCHAIN_CONSENSUS_API_URL = 'http://someurl'; // Ensure chain is picked up
    const config = await loadConfig();
    const chainConfig = config.getChainConfig('testchain');
    expect(chainConfig?.executionRpcUrl).toBeUndefined();
  });
  
  test('Test Case 4b: Empty string for executionRpcUrl (alternative check)', async () => {
    // This test is to ensure that if ONLY execution URL is empty, it's still handled
    process.env.EMPTYEXEC_EXECUTION_RPC_URL = '';
    // We must define at least one var for "EMPTYEXEC" chain to be registered
    process.env.EMPTYEXEC_PROMETHEUS_URL = 'http://localhost:9090'; 
    const config = await loadConfig();
    const chainConfig = config.getChainConfig('emptyexec');
    expect(chainConfig?.executionRpcUrl).toBeUndefined();
    expect(chainConfig?.prometheusUrl).toBe('http://localhost:9090');
  });


  test('Test Case 5: String with only commas/whitespace for consensusApiUrl', async () => {
    process.env.TESTCHAIN_EXECUTION_RPC_URL = 'http://someurl'; // Ensure chain is picked up
    process.env.TESTCHAIN_CONSENSUS_API_URL = ', ,, ';
    const config = await loadConfig();
    const chainConfig = config.getChainConfig('testchain');
    expect(chainConfig?.consensusApiUrl).toBeUndefined();
  });

  test('Test Case 6: Undefined variable for executionRpcUrl', async () => {
    // Ensure OTHERCHAIN_EXECUTION_RPC_URL is not set by not setting it
    // but set another var for OTHERCHAIN to be recognized
    process.env.OTHERCHAIN_PROMETHEUS_URL = 'http://localhost:9091';
    const config = await loadConfig();
    const chainConfig = config.getChainConfig('otherchain');
    expect(chainConfig?.executionRpcUrl).toBeUndefined();
    expect(chainConfig?.prometheusUrl).toBe('http://localhost:9091'); // verify chain was picked up
  });

  test('Chain name discovery and case insensitivity', async () => {
    process.env.MyChain_EXECUTION_RPC_URL = 'http://mychain:8545';
    const config = await loadConfig();
    const chainConfig = config.getChainConfig('mychain'); // query with lowercase
    expect(chainConfig?.executionRpcUrl).toEqual(['http://mychain:8545']);
    const chainConfigUpper = config.getChainConfig('MYCHAIN'); // query with uppercase
    expect(chainConfigUpper?.executionRpcUrl).toEqual(['http://mychain:8545']);
  });

  test('Should not pick up DEFAULT_ prefixed variables as chains', async () => {
    process.env.DEFAULT_EXECUTION_RPC_URL = 'http://default:8545';
    const config = await loadConfig();
    expect(config.getChainConfig('default')).toBeUndefined();
    // Check that it doesn't interfere with a legit chain named 'DEFAULT' if one were explicitly defined
    process.env.DEFAULT_CHAIN_EXECUTION_RPC_URL = 'http://defaultchain:8545';
    const config2 = await loadConfig(); // Must reload due to env change
    expect(config2.getChainConfig('default_chain')).toBeDefined();
  });
});
