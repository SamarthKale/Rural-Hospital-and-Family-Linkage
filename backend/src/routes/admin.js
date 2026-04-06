const express = require('express');
const { z } = require('zod');
const supabase = require('../utils/supabaseClient');
const logger = require('../utils/logger');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

// All admin routes require admin role
router.use(roleGuard('admin'));

// ---------------------------------------------------------------------------
// GET /api/admin/users
// ---------------------------------------------------------------------------
router.get('/users', async (req, res, next) => {
  try {
    const { data: users, error } = await supabase
      .from('platform_users')
      .select(`
        id, full_name, phone, role, is_active, created_at, updated_at,
        user_village_assignments(village_id, villages(id, name))
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = (users || []).map((u) => ({
      id: u.id,
      fullName: u.full_name,
      phone: u.phone,
      role: u.role,
      isActive: u.is_active,
      createdAt: u.created_at,
      assignedVillages: (u.user_village_assignments || []).map((a) => ({
        id: a.village_id,
        name: a.villages?.name,
      })),
    }));

    // Fetch emails from Supabase Auth
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const emailMap = {};
    (authUsers?.users || []).forEach((au) => {
      emailMap[au.id] = au.email;
    });

    result.forEach((u) => {
      u.email = emailMap[u.id] || null;
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/users
// ---------------------------------------------------------------------------
const createUserSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'doctor', 'field_worker', 'supervisor']),
  village_ids: z.array(z.string().uuid()).optional().default([]),
});

router.post('/users', async (req, res, next) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { full_name, email, password, phone, role, village_ids } = parsed.data;

    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return res.status(400).json({
        error: { code: 'AUTH_CREATE_FAILED', message: authError.message },
      });
    }

    const userId = authData.user.id;

    // 2. Insert platform_users row
    const { error: puError } = await supabase
      .from('platform_users')
      .insert({
        id: userId,
        full_name,
        phone: phone || null,
        role,
      });

    if (puError) {
      // Cleanup auth user on failure
      await supabase.auth.admin.deleteUser(userId);
      throw puError;
    }

    // 3. Insert village assignments
    if (village_ids.length > 0) {
      const assignments = village_ids.map((vid) => ({
        user_id: userId,
        village_id: vid,
        assigned_by: req.user.id,
      }));
      await supabase.from('user_village_assignments').insert(assignments);
    }

    res.status(201).json({
      id: userId,
      fullName: full_name,
      email,
      role,
      villageIds: village_ids,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id
// ---------------------------------------------------------------------------
const updateUserSchema = z.object({
  full_name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'doctor', 'field_worker', 'supervisor']).optional(),
  is_active: z.boolean().optional(),
  village_ids: z.array(z.string().uuid()).optional(),
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const userId = req.params.id;
    const { village_ids, ...updateData } = parsed.data;

    // Update platform_users
    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from('platform_users')
        .update(updateData)
        .eq('id', userId);
      if (error) throw error;
    }

    // Update village assignments if provided
    if (village_ids !== undefined) {
      // Remove existing
      await supabase.from('user_village_assignments').delete().eq('user_id', userId);

      // Insert new
      if (village_ids.length > 0) {
        const assignments = village_ids.map((vid) => ({
          user_id: userId,
          village_id: vid,
          assigned_by: req.user.id,
        }));
        await supabase.from('user_village_assignments').insert(assignments);
      }
    }

    res.json({ message: 'User updated successfully.' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/audit-logs
// ---------------------------------------------------------------------------
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { user_id, table_name, start_date, end_date, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('audit_logs')
      .select(`
        id, user_id, action, table_name, record_id,
        old_values, new_values, ip_address, user_agent, created_at,
        platform_users(full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (user_id) query = query.eq('user_id', user_id);
    if (table_name) query = query.eq('table_name', table_name);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/summary
// ---------------------------------------------------------------------------
router.get('/analytics/summary', async (req, res, next) => {
  // Also allow supervisor
  try {
    const { village_id } = req.query;

    // Active pregnancies
    let pregQuery = supabase.from('v_active_pregnancies').select('*', { count: 'exact' });
    if (village_id) pregQuery = pregQuery.eq('village_id', village_id);
    const { data: activePregs, count: pregCount } = await pregQuery;

    // Critical alerts
    let alertQuery = supabase.from('alerts').select('id', { count: 'exact' }).eq('status', 'active');
    if (village_id) alertQuery = alertQuery.eq('village_id', village_id);
    const { count: alertCount } = await alertQuery;

    // Overdue vaccines
    let vaccQuery = supabase.from('immunization_records').select('id', { count: 'exact' }).eq('is_overdue', true).is('administered_date', null);
    const { count: overdueVaccines } = await vaccQuery;

    // Total households
    let hhQuery = supabase.from('households').select('id', { count: 'exact' });
    if (village_id) hhQuery = hhQuery.eq('village_id', village_id);
    const { count: householdCount } = await hhQuery;

    // Deliveries this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    let delQuery = supabase.from('pregnancy_outcomes')
      .select('id', { count: 'exact' })
      .gte('outcome_date', startOfMonth.toISOString().split('T')[0])
      .in('outcome_type', ['normal_delivery', 'c_section']);
    const { count: deliveriesThisMonth } = await delQuery;

    // Immunization coverage
    let covQuery = supabase.from('v_immunization_coverage').select('*');
    if (village_id) covQuery = covQuery.eq('village_id', village_id);
    const { data: immunCoverage } = await covQuery;

    // Risk distribution
    const riskDist = {};
    (activePregs || []).forEach((p) => {
      const vid = p.village_id;
      if (!riskDist[vid]) riskDist[vid] = { village_name: p.village_name, low: 0, medium: 0, high: 0, critical: 0 };
      riskDist[vid][p.current_risk_level]++;
    });

    // Pregnancy outcome breakdown
    const { data: outcomes } = await supabase
      .from('pregnancy_outcomes')
      .select('outcome_type');
    const outcomeCounts = {};
    (outcomes || []).forEach((o) => {
      outcomeCounts[o.outcome_type] = (outcomeCounts[o.outcome_type] || 0) + 1;
    });

    // Monthly pregnancy counts (last 12 months)
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];

      let mQuery = supabase.from('pregnancies')
        .select('id', { count: 'exact' })
        .lte('registration_date', monthEnd)
        .in('status', ['registered', 'anc_ongoing', 'delivered', 'complicated']);

      const { count: mc } = await mQuery;
      monthlyData.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        count: mc || 0,
      });
    }

    // Illness frequency (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const { data: illnesses } = await supabase
      .from('illness_logs')
      .select('illness_name, onset_date')
      .gte('onset_date', sixMonthsAgo.toISOString().split('T')[0])
      .order('onset_date');

    const illnessFreq = {};
    (illnesses || []).forEach((il) => {
      const name = il.illness_name;
      if (!illnessFreq[name]) illnessFreq[name] = 0;
      illnessFreq[name]++;
    });
    const topIllnesses = Object.entries(illnessFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    res.json({
      kpis: {
        activePregnancies: pregCount || 0,
        criticalAlerts: alertCount || 0,
        overdueVaccines: overdueVaccines || 0,
        totalHouseholds: householdCount || 0,
        deliveriesThisMonth: deliveriesThisMonth || 0,
      },
      monthlyPregnancies: monthlyData,
      outcomeBreakdown: outcomeCounts,
      immunizationCoverage: immunCoverage || [],
      riskDistribution: Object.values(riskDist),
      topIllnesses,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/analytics/villages/:id
// ---------------------------------------------------------------------------
router.get('/analytics/villages/:id', async (req, res, next) => {
  try {
    const villageId = req.params.id;

    const { data: village } = await supabase
      .from('villages')
      .select('id, name')
      .eq('id', villageId)
      .single();

    if (!village) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Village not found.' },
      });
    }

    // Households
    const { count: hhCount } = await supabase
      .from('households')
      .select('id', { count: 'exact' })
      .eq('village_id', villageId);

    // Active pregnancies
    const { data: pregs, count: pregCount } = await supabase
      .from('v_active_pregnancies')
      .select('*', { count: 'exact' })
      .eq('village_id', villageId);

    // Alerts
    const { count: alertCount } = await supabase
      .from('alerts')
      .select('id', { count: 'exact' })
      .eq('village_id', villageId)
      .eq('status', 'active');

    // Immunization coverage
    const { data: coverage } = await supabase
      .from('v_immunization_coverage')
      .select('*')
      .eq('village_id', villageId);

    res.json({
      village,
      households: hhCount || 0,
      activePregnancies: pregCount || 0,
      activeAlerts: alertCount || 0,
      pregnancies: pregs || [],
      immunizationCoverage: coverage || [],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
