import { Router } from 'express';
import { auth } from '../middlewares/auth.middleware'; // Middleware to authenticate users via JWT
import { adminAuth } from '../middlewares/admin.middleware'; // Middleware to ensure user is an admin
import { addChain, listChains, updateChain, deleteChain } from '../controllers/chain.controller'; // Controller functions for chain logic

const router = Router();

// All routes in this file are protected by both `auth` (JWT authentication)
// and `adminAuth` (ensuring the authenticated user is an administrator).

/**
 * Route to add a new blockchain (Chain) to the system.
 * Requires admin privileges.
 * POST /admin/chains
 * Body: { chainName: string, chainId: string, description?: string }
 */
router.post('/chains', auth, adminAuth, addChain);

/**
 * Route to list all configured Chains in the system.
 * Requires admin privileges.
 * GET /admin/chains
 */
router.get('/chains', auth, adminAuth, listChains);

/**
 * Route to update an existing Chain's details.
 * Requires admin privileges.
 * PUT /admin/chains/:chainId
 * Body: { chainName?: string, chainId?: string (new chainId), description?: string, isEnabled?: boolean }
 * Note: :chainId in the URL refers to the current chainId of the chain to be updated.
 * The new chainId, if being changed, is provided in the request body.
 */
router.put('/chains/:chainId', auth, adminAuth, updateChain);

/**
 * Route to delete a Chain from the system.
 * Requires admin privileges.
 * DELETE /admin/chains/:chainId
 */
router.delete('/chains/:chainId', auth, adminAuth, deleteChain);

export default router;
