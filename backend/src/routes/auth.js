const express = require('express');
const { z } = require('zod');
const supabase = require('../utils/supabaseClient');
const logger = require('../utils/logger');
const verifyJWT = require('../middleware/verifyJWT');
const villageScope = require('../middleware/villageScope');

const router = express.Router();

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { email, password } = parsed.data;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({
        error: { code: 'AUTH_FAILED', message: 'Invalid email or password.' },
      });
    }

    const userId = data.user.id;

    // Fetch platform user
    const { data: platformUser, error: puError } = await supabase
      .from('platform_users')
      .select('id, full_name, role, is_active, phone')
      .eq('id', userId)
      .single();

    if (puError || !platformUser) {
      return res.status(403).json({
        error: { code: 'USER_NOT_REGISTERED', message: 'Your account is not registered on this platform.' },
      });
    }

    if (!platformUser.is_active) {
      return res.status(403).json({
        error: { code: 'USER_INACTIVE', message: 'Your account has been deactivated. Contact an administrator.' },
      });
    }

    // Fetch assigned villages
    const { data: assignments } = await supabase
      .from('user_village_assignments')
      .select('village_id')
      .eq('user_id', userId);

    const assignedVillageIds = (assignments || []).map((a) => a.village_id);

    res.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: platformUser.id,
        fullName: platformUser.full_name,
        role: platformUser.role,
        phone: platformUser.phone,
        assignedVillageIds,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
router.post('/logout', verifyJWT, async (req, res, next) => {
  try {
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
router.get('/me', verifyJWT, villageScope, async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('platform_users')
      .select('id, full_name, role, phone, is_active')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found.' },
      });
    }

    const { data: assignments } = await supabase
      .from('user_village_assignments')
      .select('village_id, villages(id, name)')
      .eq('user_id', req.user.id);

    res.json({
      id: user.id,
      fullName: user.full_name,
      role: user.role,
      phone: user.phone,
      isActive: user.is_active,
      assignedVillages: (assignments || []).map((a) => ({
        id: a.village_id,
        name: a.villages?.name,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
