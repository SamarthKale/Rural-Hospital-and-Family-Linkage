const express = require('express');
const { z } = require('zod');
const supabase = require('../utils/supabaseClient');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/members/:memberId/illness-logs
// ---------------------------------------------------------------------------
router.get('/:memberId/illness-logs', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('illness_logs')
      .select(`
        id, member_id, illness_name, icd10_code, onset_date,
        resolved_date, is_chronic, notes, recorded_by, created_at, updated_at,
        medications(id, drug_name, dose, frequency, duration_days, start_date, end_date, notes)
      `)
      .eq('member_id', req.params.memberId)
      .order('onset_date', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/illness-logs
// ---------------------------------------------------------------------------
const createIllnessSchema = z.object({
  member_id: z.string().uuid(),
  illness_name: z.string().min(1, 'Illness name is required'),
  icd10_code: z.string().optional(),
  onset_date: z.string().optional(),
  is_chronic: z.boolean().optional().default(false),
  notes: z.string().optional(),
  medications: z.array(z.object({
    drug_name: z.string().min(1),
    dose: z.string().optional(),
    frequency: z.string().optional(),
    duration_days: z.number().int().positive().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),
});

router.post('/', async (req, res, next) => {
  if (req.baseUrl !== '/api/illness-logs') return next();

  try {
    const parsed = createIllnessSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { medications, ...illnessData } = parsed.data;

    // Create a visit log for this illness recording
    const { data: visitLog } = await supabase
      .from('visit_logs')
      .insert({
        member_id: illnessData.member_id,
        visit_type: 'general_consultation',
        visit_date: illnessData.onset_date || new Date().toISOString().split('T')[0],
        conducted_by: req.user.id,
      })
      .select()
      .single();

    const { data: illnessLog, error } = await supabase
      .from('illness_logs')
      .insert({
        ...illnessData,
        visit_log_id: visitLog?.id || null,
        recorded_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Insert medications if provided
    if (medications && medications.length > 0) {
      const medsToInsert = medications.map((med) => ({
        ...med,
        illness_log_id: illnessLog.id,
        prescribed_by: req.user.id,
      }));

      await supabase.from('medications').insert(medsToInsert);
    }

    // Update chronic illness flag on member if marked chronic
    if (illnessData.is_chronic) {
      await supabase
        .from('members')
        .update({ has_chronic_illness: true })
        .eq('id', illnessData.member_id);
    }

    res.status(201).json(illnessLog);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/illness-logs/:id
// ---------------------------------------------------------------------------
const updateIllnessSchema = z.object({
  illness_name: z.string().optional(),
  icd10_code: z.string().optional(),
  onset_date: z.string().optional(),
  resolved_date: z.string().optional().nullable(),
  is_chronic: z.boolean().optional(),
  notes: z.string().optional(),
});

router.patch('/:id', async (req, res, next) => {
  if (req.baseUrl !== '/api/illness-logs') return next();

  try {
    const parsed = updateIllnessSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { data, error } = await supabase
      .from('illness_logs')
      .update(parsed.data)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
