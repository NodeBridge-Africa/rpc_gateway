import supertest from "supertest";
import express, { Request, Response } from "express";
import { createTestApp } from "./helpers/testApp";
import User from "../src/models/user.model";
import { testUtils } from "./setup";
import nock from "nock";
import { ProxyController, getRandomUrl } from "../src/controllers/proxy.controller";
import { config as appConfig } from '../src/config'; // Used for mocking getChainConfig
import { ChainConfig } from "../src/config/types";

const app = createTestApp();
const existingAppRequest = supertest(app); // Renamed to avoid conflict

// Mock fetch
global.fetch = jest.fn();

describe("Proxy Routes (Integration)", () => {
  let testUser: any;
  let apiKey: string;

  beforeEach(async () => {
    const userData = testUtils.generateTestUser();
    testUser = await User.create({
      ...userData,
      maxRps: 100,
    });
    apiKey = testUser.apiKey;
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
    jest.clearAllMocks(); // Clear fetch mocks
  });

  describe("Execution Layer Proxy (/exec)", () => {
    it("should proxy JSON-RPC requests to execution layer", async () => {
      const mockResponse = { jsonrpc: "2.0", id: 1, result: "0x12a05f200" };
      nock("http://192.168.8.229:8545").post("/").reply(200, mockResponse);
      const rpcRequest = { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 };
      const response = await existingAppRequest.post(`/exec/${apiKey}`).send(rpcRequest).expect(200);
      expect(response.body).toEqual(mockResponse);
      expect(response.headers["x-rpc-gateway"]).toBe("NodeBridge");
      expect(response.headers["x-endpoint-type"]).toBe("execution");
    });

    it("should handle execution layer errors", async () => {
      nock("http://192.168.8.229:8545").post("/").replyWithError("Connection refused");
      const rpcRequest = { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 };
      const response = await existingAppRequest.post(`/exec/${apiKey}`).send(rpcRequest).expect(502);
      expect(response.body.error).toBe("Bad Gateway");
      expect(response.body.message).toBe("Failed to connect to the Sepolia node");
      expect(response.body.endpointType).toBe("execution");
    });

    it("should proxy requests with path parameters", async () => {
      nock("http://192.168.8.229:8545").get("/some/path").reply(200, { success: true });
      const response = await existingAppRequest.get(`/exec/${apiKey}/some/path`).expect(200);
      expect(response.body.success).toBe(true);
    });

    it("should reject requests without valid API key", async () => {
      const rpcRequest = { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 };
      const response = await existingAppRequest.post("/exec/invalid-key").send(rpcRequest).expect(403);
      expect(response.body.error).toBe("Invalid or inactive API key");
    });
  });

  describe("Consensus Layer Proxy (/cons)", () => {
    it("should proxy REST requests to consensus layer", async () => {
      const mockResponse = { data: { slot: "4636363", parent_root: "0x1234567890abcdef", state_root: "0xabcdef1234567890" } };
      nock("http://192.168.8.229:5052").get("/eth/v1/beacon/headers").reply(200, mockResponse);
      const response = await existingAppRequest.get(`/cons/${apiKey}/eth/v1/beacon/headers`).expect(200);
      expect(response.body).toEqual(mockResponse);
      expect(response.headers["x-rpc-gateway"]).toBe("NodeBridge");
      expect(response.headers["x-endpoint-type"]).toBe("consensus");
    });

    it("should handle consensus layer errors", async () => {
      nock("http://192.168.8.229:5052").get("/eth/v1/beacon/headers").replyWithError("Service unavailable");
      const response = await existingAppRequest.get(`/cons/${apiKey}/eth/v1/beacon/headers`).expect(502);
      expect(response.body.error).toBe("Bad Gateway");
      expect(response.body.endpointType).toBe("consensus");
    });

    it("should proxy POST requests to consensus layer", async () => {
      const mockResponse = { success: true };
      const postData = { validator_index: 1234 };
      nock("http://192.168.8.229:5052").post("/eth/v1/beacon/some_endpoint").reply(200, mockResponse);
      const response = await existingAppRequest.post(`/cons/${apiKey}/eth/v1/beacon/some_endpoint`).send(postData).expect(200);
      expect(response.body).toEqual(mockResponse);
    });

    it("should reject requests without valid API key", async () => {
      const response = await existingAppRequest.get("/cons/invalid-key/eth/v1/beacon/headers").expect(403);
      expect(response.body.error).toBe("Invalid or inactive API key");
    });
  });

  describe("Request Tracking (Integration)", () => {
    it("should increment user request counters", async () => {
      nock("http://192.168.8.229:8545").post("/").reply(200, { result: "success" });
      const initialRequests = testUser.requests;
      const initialDailyRequests = testUser.dailyRequests;
      await existingAppRequest.post(`/exec/${apiKey}`).send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 }).expect(200);
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.requests).toBe(initialRequests + 1);
      expect(updatedUser?.dailyRequests).toBe(initialDailyRequests + 1);
    });

    it("should apply rate limiting to proxy requests", async () => {
      const limitedUser = await User.create({ ...testUtils.generateTestUser(), maxRps: 1 });
      nock("http://192.168.8.229:8545").post("/").times(3).reply(200, { result: "success" });
      await existingAppRequest.post(`/exec/${limitedUser.apiKey}`).send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 }).expect(200);
      const response = await existingAppRequest.post(`/exec/${limitedUser.apiKey}`).send({ jsonrpc: "2.0", method: "eth_blockNumber", id: 2 }).expect(429);
      expect(response.body.error).toBe("Rate limit exceeded");
    });
  });

  describe("Health Check (Integration)", () => {
    it("should return health status for both endpoints", async () => {
      nock("http://192.168.8.229:8545").post("/").reply(200, { jsonrpc: "2.0", result: "0x12345", id: 1 });
      nock("http://192.168.8.229:5052").get("/eth/v1/node/health").reply(200);
      const response = await existingAppRequest.get("/health").expect(200);
      expect(response.body.status).toBe("healthy");
      expect(response.body.checks.execution.status).toBe("healthy");
      expect(response.body.checks.consensus.status).toBe("healthy");
    });

    it("should return unhealthy status when endpoints are down", async () => {
      nock("http://192.168.8.229:8545").post("/").replyWithError("Connection refused");
      nock("http://192.168.8.229:5052").get("/eth/v1/node/health").replyWithError("Service unavailable");
      const response = await existingAppRequest.get("/health").expect(503);
      expect(response.body.status).toBe("unhealthy");
      expect(response.body.checks.execution.status).toBe("unhealthy");
      expect(response.body.checks.consensus.status).toBe("unhealthy");
    });
  });

  describe("Response Headers (Integration)", () => {
    it("should add custom headers to proxy responses", async () => {
      nock("http://192.168.8.229:8545").post("/").reply(200, { result: "test" });
      const response = await existingAppRequest.post(`/exec/${apiKey}`).send({ jsonrpc: "2.0", method: "test", id: 1 });
      expect(response.headers["x-rpc-gateway"]).toBe("NodeBridge");
      expect(response.headers["x-endpoint-type"]).toBe("execution");
      expect(response.headers["x-response-time"]).toBeDefined();
    });

    it("should include rate limit headers", async () => {
      nock("http://192.168.8.229:8545").post("/").reply(200, { result: "test" });
      const response = await existingAppRequest.post(`/exec/${apiKey}`).send({ jsonrpc: "2.0", method: "test", id: 1 });
      expect(response.headers["x-ratelimit-limit"]).toBeDefined();
      expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
      expect(response.headers["x-ratelimit-reset"]).toBeDefined();
    });
  });
});


// --- Unit tests for getRandomUrl and ProxyController ---
describe('getRandomUrl', () => {
  test('should return one of the URLs from a list', () => {
    const urls = ['url1', 'url2', 'url3'];
    const result = getRandomUrl(urls);
    expect(urls).toContain(result);
  });

  test('should return the only URL if list has one item', () => {
    const urls = ['url1'];
    expect(getRandomUrl(urls)).toBe('url1');
  });

  test('should return undefined for an empty list', () => {
    expect(getRandomUrl([])).toBeUndefined();
  });

  test('should return undefined if urls is undefined', () => {
    expect(getRandomUrl(undefined)).toBeUndefined();
  });

  test('should have a reasonable distribution (statistical test - might occasionally fail)', () => {
    const urls = ['url1', 'url2', 'url3'];
    const selections: { [key: string]: number } = { url1: 0, url2: 0, url3: 0 };
    const iterations = 300; // Number of times to call getRandomUrl

    for (let i = 0; i < iterations; i++) {
      const selected = getRandomUrl(urls);
      if (selected) {
        selections[selected]++;
      }
    }
    // Check if each URL was selected at least once (for a small number of URLs and enough iterations)
    // A more robust check would involve chi-squared test, but for simplicity:
    expect(selections.url1).toBeGreaterThan(0);
    expect(selections.url2).toBeGreaterThan(0);
    expect(selections.url3).toBeGreaterThan(0);
    // And that counts are roughly balanced (e.g., not all selections are one URL)
    // This is a heuristic, not a perfect statistical test.
    const expectedMin = iterations / urls.length * 0.5; // Expect at least 50% of fair share
    const expectedMax = iterations / urls.length * 1.5; // Expect at most 150% of fair share
    expect(selections.url1).toBeGreaterThanOrEqual(expectedMin);
    expect(selections.url1).toBeLessThanOrEqual(expectedMax);
    expect(selections.url2).toBeGreaterThanOrEqual(expectedMin);
    expect(selections.url2).toBeLessThanOrEqual(expectedMax);
    expect(selections.url3).toBeGreaterThanOrEqual(expectedMin);
    expect(selections.url3).toBeLessThanOrEqual(expectedMax);
  });
});

describe('ProxyController.checkProxyHealth', () => {
  let proxyController: ProxyController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    proxyController = new ProxyController();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockRequest = { params: {} };
    mockResponse = {
      status: mockStatus,
      json: mockJson,
    };
    jest.spyOn(appConfig, 'getChainConfig');
    (global.fetch as jest.Mock).mockReset(); // Reset fetch mock before each test
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Test Case 1: Multiple execution URLs, one is chosen for health check', async () => {
    const execUrls = ['http://exec1.com', 'http://exec2.com'];
    (appConfig.getChainConfig as jest.Mock).mockReturnValue({
      executionRpcUrl: execUrls,
      consensusApiUrl: undefined,
    } as ChainConfig);

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    mockRequest.params!.chain = 'testchain';
    await proxyController.checkProxyHealth(mockRequest as Request, mockResponse as Response);

    expect(appConfig.getChainConfig).toHaveBeenCalledWith('testchain');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(execUrls).toContain(fetchCall[0]); // Check if one of the exec URLs was called
    
    expect(mockStatus).toHaveBeenCalledWith(200);
    const responseJson = mockJson.mock.calls[0][0];
    expect(responseJson.status).toBe('healthy');
    expect(responseJson.checks.execution.status).toBe('healthy');
    expect(execUrls).toContain(responseJson.checks.execution.url); // Check if the called URL is in the response
    expect(responseJson.checks.consensus.status).toBe('not_configured');
  });

  test('Test Case 2: No consensus URLs, consensus shows not_configured', async () => {
    const execUrls = ['http://exec1.com'];
    (appConfig.getChainConfig as jest.Mock).mockReturnValue({
      executionRpcUrl: execUrls,
      consensusApiUrl: undefined,
    } as ChainConfig);

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // For execution

    mockRequest.params!.chain = 'testchain';
    await proxyController.checkProxyHealth(mockRequest as Request, mockResponse as Response);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(execUrls[0]);
    
    expect(mockStatus).toHaveBeenCalledWith(200);
    const responseJson = mockJson.mock.calls[0][0];
    expect(responseJson.status).toBe('healthy');
    expect(responseJson.checks.execution.status).toBe('healthy');
    expect(responseJson.checks.execution.url).toBe(execUrls[0]);
    expect(responseJson.checks.consensus.status).toBe('not_configured');
    expect(responseJson.checks.consensus.url).toBeNull();
  });

  test('Test Case 3: Empty URL arrays, both layers show not_configured', async () => {
    (appConfig.getChainConfig as jest.Mock).mockReturnValue({
      executionRpcUrl: [],
      consensusApiUrl: [],
    } as ChainConfig);

    mockRequest.params!.chain = 'testchain';
    await proxyController.checkProxyHealth(mockRequest as Request, mockResponse as Response);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(200); // Or 404 if no URLs at all is an error
    const responseJson = mockJson.mock.calls[0][0];
    // If no URLs provided at all, the controller might return a 404 early.
    // Based on current controller logic, if chainConfig exists but URLs are empty, it's 'not_configured'.
    // If it was changed to return 404 if both arrays are empty, this test needs adjustment.
    // The current controller code:
    // if ((!executionRpcUrls || executionRpcUrls.length === 0) && (!consensusApiUrls || consensusApiUrls.length === 0)) {
    //     res.status(404).json({ error: `No RPC/API URLs configured for chain '${chainName}'.` });
    // This means we should expect 404 here.
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(responseJson.error).toBe("No RPC/API URLs configured for chain 'testchain'.");
  });

  test('Test Case 4: Undefined URL arrays, both layers show not_configured (effectively same as empty)', async () => {
    (appConfig.getChainConfig as jest.Mock).mockReturnValue({
      executionRpcUrl: undefined,
      consensusApiUrl: undefined,
    } as ChainConfig);
    
    mockRequest.params!.chain = 'testchain';
    await proxyController.checkProxyHealth(mockRequest as Request, mockResponse as Response);

    expect(global.fetch).not.toHaveBeenCalled();
    // Similar to Test Case 3, this should result in a 404
    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson.mock.calls[0][0].error).toBe("No RPC/API URLs configured for chain 'testchain'.");
  });

  test('Chain not configured', async () => {
    (appConfig.getChainConfig as jest.Mock).mockReturnValue(undefined);
    mockRequest.params!.chain = 'unknownchain';
    await proxyController.checkProxyHealth(mockRequest as Request, mockResponse as Response);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson.mock.calls[0][0].error).toBe("Configuration for chain 'unknownchain' not found.");
  });

  test('Execution URL fails, Consensus URL healthy', async () => {
    const execUrls = ['http://exec-fail.com'];
    const consUrls = ['http://cons-ok.com'];
    (appConfig.getChainConfig as jest.Mock).mockReturnValue({
      executionRpcUrl: execUrls,
      consensusApiUrl: consUrls,
    } as ChainConfig);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false }) // Execution fails
      .mockResolvedValueOnce({ ok: true });  // Consensus OK

    mockRequest.params!.chain = 'testchain';
    await proxyController.checkProxyHealth(mockRequest as Request, mockResponse as Response);
    
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(execUrls[0]);
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe(`${consUrls[0]}/eth/v1/node/health`);

    expect(mockStatus).toHaveBeenCalledWith(503); // Overall unhealthy
    const responseJson = mockJson.mock.calls[0][0];
    expect(responseJson.status).toBe('unhealthy');
    expect(responseJson.checks.execution.status).toBe('unhealthy');
    expect(responseJson.checks.execution.url).toBe(execUrls[0]);
    expect(responseJson.checks.consensus.status).toBe('healthy');
    expect(responseJson.checks.consensus.url).toBe(consUrls[0]);
  });
  
  test('Execution URL throws error, Consensus URL healthy', async () => {
    const execUrls = ['http://exec-error.com'];
    const consUrls = ['http://cons-ok.com'];
    (appConfig.getChainConfig as jest.Mock).mockReturnValue({
      executionRpcUrl: execUrls,
      consensusApiUrl: consUrls,
    } as ChainConfig);

    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error("Network Error")) // Execution throws
      .mockResolvedValueOnce({ ok: true });  // Consensus OK

    mockRequest.params!.chain = 'testchain';
    await proxyController.checkProxyHealth(mockRequest as Request, mockResponse as Response);
    
    expect(mockStatus).toHaveBeenCalledWith(503); // Overall unhealthy
    const responseJson = mockJson.mock.calls[0][0];
    expect(responseJson.status).toBe('unhealthy');
    expect(responseJson.checks.execution.status).toBe('unhealthy');
    expect(responseJson.checks.consensus.status).toBe('healthy');
  });

  test('Chain parameter missing', async () => {
    mockRequest.params!.chain = undefined; // Missing chain
    await proxyController.checkProxyHealth(mockRequest as Request, mockResponse as Response);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson.mock.calls[0][0].error).toBe("Chain parameter is missing.");
  });
});
