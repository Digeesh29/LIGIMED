import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Authenticate with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (authError) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Get user's organization data
        const { data: userData, error: userError } = await supabase
            .from('app_users')
            .select('id, org_id, name, role')
            .eq('auth_uid', authData.user.id)
            .single();
        
        if (userError || !userData) {
            return res.status(404).json({ error: 'User profile not found' });
        }
        
        // Return token and user data
        res.json({
            token: authData.session.access_token,
            user: {
                id: userData.id,
                org_id: userData.org_id,
                name: userData.name,
                role: userData.role,
                email: authData.user.email
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const { data, error } = await supabase.auth.getUser(token);
        
        if (error || !data.user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        res.json({ valid: true });
        
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (token) {
            await supabase.auth.signOut();
        }
        
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user profile
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !authData.user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        const { data: userData } = await supabase
            .from('app_users')
            .select('id, org_id, name, role')
            .eq('auth_uid', authData.user.id)
            .single();
        
        res.json({
            user: {
                id: userData.id,
                org_id: userData.org_id,
                name: userData.name,
                role: userData.role,
                email: authData.user.email
            }
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
