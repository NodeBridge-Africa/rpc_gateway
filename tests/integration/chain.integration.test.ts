import supertest from 'supertest';
import { app, createUser, loginUser, clearDatabase, Chain } from './test-setup';

const request = supertest(app);

describe('Chain Management Flow (Admin)', () => {
  let regularUserToken: string;
  let adminUserToken: string;
  let createdChainId: string; // Store chainId for use across tests
  let createdChainObjectId: string; // Store _id for direct DB checks if needed

  beforeAll(async () => {
    // Create regular user and login
    await createUser({ email: 'user.chain@example.com', password: 'password123' });
    regularUserToken = await loginUser(request, 'user.chain@example.com', 'password123');

    // Create admin user and login
    await createUser({ email: 'admin.chain@example.com', password: 'password123', isAdmin: true });
    adminUserToken = await loginUser(request, 'admin.chain@example.com', 'password123');
  });

  afterAll(async () => {
    await clearDatabase();
  });
  
  beforeEach(async () => {
    // Clear chains before each test to ensure isolation for creation/listing tests
    // but be careful if a test relies on a chain created in a previous step within the same describe block.
    // For this flow, it's better to clean up specific chains created in tests or manage state carefully.
    // await Chain.deleteMany({}); // This might be too broad if tests depend on each other.
  });


  describe('Admin Chain Operations', () => {
    const chainData = {
      chainName: 'MyAdminChain',
      chainId: 'MAC01',
      description: 'Admin created chain',
    };

    it('should create a new chain using admin token', async () => {
      const res = await request.post('/admin/chains').set('Authorization', `Bearer ${adminUserToken}`).send(chainData);
      expect(res.status).toBe(201);
      expect(res.body.chainName).toBe(chainData.chainName);
      expect(res.body.chainId).toBe(chainData.chainId);
      expect(res.body.isEnabled).toBe(true);
      createdChainId = res.body.chainId; // Save for later tests
      createdChainObjectId = res.body._id;
    });

    it('should list chains, including the newly created one', async () => {
      // Create another chain to ensure listing works with multiple items
      await request.post('/admin/chains').set('Authorization', `Bearer ${adminUserToken}`).send({ chainName: "ChainToEnsureList", chainId: "CTEL" });

      const res = await request.get('/admin/chains').set('Authorization', `Bearer ${adminUserToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1); // Should be at least 1, possibly more if not cleared
      expect(res.body.some((chain: any) => chain.chainId === createdChainId)).toBe(true);
      expect(res.body.some((chain: any) => chain.chainId === "CTEL")).toBe(true);
    });

    it('should update the created chain', async () => {
      const updates = {
        description: 'Updated description by admin',
        isEnabled: false,
      };
      const res = await request.put(`/admin/chains/${createdChainId}`).set('Authorization', `Bearer ${adminUserToken}`).send(updates);
      expect(res.status).toBe(200);
      expect(res.body.description).toBe(updates.description);
      expect(res.body.isEnabled).toBe(updates.isEnabled);

      // Verify in DB
      const updatedChain = await Chain.findById(createdChainObjectId);
      expect(updatedChain?.description).toBe(updates.description);
      expect(updatedChain?.isEnabled).toBe(false);
    });

    it('should return 409 when trying to update chainId to an existing one', async () => {
      // Create a dummy chain first
      const dummyChain = { chainName: 'DummyChainForConflict', chainId: 'DUMMY01' };
      await request.post('/admin/chains').set('Authorization', `Bearer ${adminUserToken}`).send(dummyChain);

      const updates = { chainId: dummyChain.chainId }; // Try to update our chain to use DUMMY01
      const res = await request.put(`/admin/chains/${createdChainId}`).set('Authorization', `Bearer ${adminUserToken}`).send(updates);
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('New chainId already exists');
    });
    
    it('should return 409 when trying to update chainName to an existing one', async () => {
      // Create a dummy chain first
      const dummyChain = { chainName: 'DummyChainNameForConflict', chainId: 'DUMMY02' };
      const dummyRes = await request.post('/admin/chains').set('Authorization', `Bearer ${adminUserToken}`).send(dummyChain);
      expect(dummyRes.status).toBe(201);


      const updates = { chainName: dummyChain.chainName }; 
      const res = await request.put(`/admin/chains/${createdChainId}`).set('Authorization', `Bearer ${adminUserToken}`).send(updates);
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('New chainName already exists');
    });


    it('should delete the chain', async () => {
      const res = await request.delete(`/admin/chains/${createdChainId}`).set('Authorization', `Bearer ${adminUserToken}`);
      expect(res.status).toBe(204); // No content

      // Verify it's gone
      const getRes = await request.get('/admin/chains').set('Authorization', `Bearer ${adminUserToken}`);
      expect(getRes.body.some((chain: any) => chain.chainId === createdChainId)).toBe(false);
      
      // Verify in DB
      const deletedChain = await Chain.findById(createdChainObjectId);
      expect(deletedChain).toBeNull();
    });
  });

  describe('Regular User Access to Admin Chain Routes', () => {
    const chainData = { chainName: 'UserAttemptChain', chainId: 'UAC01' };

    it('should deny POST /admin/chains for regular user', async () => {
      const res = await request.post('/admin/chains').set('Authorization', `Bearer ${regularUserToken}`).send(chainData);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Forbidden: User is not an administrator');
    });

    it('should deny GET /admin/chains for regular user', async () => {
      const res = await request.get('/admin/chains').set('Authorization', `Bearer ${regularUserToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Forbidden: User is not an administrator');
    });

    it('should deny PUT /admin/chains/:chainId for regular user', async () => {
      // Need a chainId to attempt to update. Let's use one created by admin (if available) or a placeholder.
      // For robustness, an admin should create a chain first if test order isn't guaranteed.
      const adminChain = await request.post('/admin/chains').set('Authorization', `Bearer ${adminUserToken}`).send({ chainName: "PreExisting", chainId: "PREX" });

      const res = await request.put(`/admin/chains/${adminChain.body.chainId}`).set('Authorization', `Bearer ${regularUserToken}`).send({ description: 'Attempted update' });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Forbidden: User is not an administrator');
    });

    it('should deny DELETE /admin/chains/:chainId for regular user', async () => {
       const adminChain = await request.post('/admin/chains').set('Authorization', `Bearer ${adminUserToken}`).send({ chainName: "PreExistingForDelete", chainId: "PREXD" });

      const res = await request.delete(`/admin/chains/${adminChain.body.chainId}`).set('Authorization', `Bearer ${regularUserToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Forbidden: User is not an administrator');
    });
  });
});
