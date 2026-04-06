const express = require('express');
const { z } = require('zod');
const supabase = require('../utils/supabaseClient');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/members/:memberId/immunizations
// ---------------------------------------------------------------------------
router.get('/:memberId/immunizations', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('immunization_records')
      .select(`
        id, member_id, vaccine_id, scheduled_date, administered_date,
        is_overdue, batch_number, administration_site,
        administered_by, adverse_reaction, notes,
        created_at, updated_at,
        vaccines(id, name, short_name, target_age_days, target_age_desc, disease_covered, doses_required)
      `)
      .eq('member_id', req.params.memberId)
      .order('scheduled_date', { ascending: true });

    if (error) throw error;

    const today = new Date().toISOString().split('T')[0];

    const result = (data || []).map((rec) => {
      let status = 'due';
      if (rec.administered_date) {
        status = 'given';
      } else if (rec.scheduled_date && rec.scheduled_date < today) {
        status = 'overdue';
      }

      return {
        ...rec,
        status,
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/immunizations — mark vaccine as administered
// ---------------------------------------------------------------------------
const administerSchema = z.object({
  immunization_record_id: z.string().uuid(),
  administered_date: z.string(),
  batch_number: z.string().optional(),
  administration_site: z.string().optional(),
  adverse_reaction: z.string().optional(),
  notes: z.string().optional(),
});

router.post('/', async (req, res, next) => {
  if (req.baseUrl !== '/api/immunizations') return next();

  try {
    const parsed = administerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { immunization_record_id, administered_date, ...rest } = parsed.data;

    // Create a visit_log
    const { data: record } = await supabase
      .from('immunization_records')
      .select('member_id')
      .eq('id', immunization_record_id)
      .single();

    if (!record) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Immunization record not found.' },
      });
    }

    const { data: visitLog } = await supabase
      .from('visit_logs')
      .insert({
        member_id: record.member_id,
        visit_type: 'immunization',
        visit_date: administered_date,
        conducted_by: req.user.id,
      })
      .select()
      .single();

    // Update immunization record
    const { data, error } = await supabase
      .from('immunization_records')
      .update({
        administered_date,
        administered_by: req.user.id,
        is_overdue: false,
        visit_log_id: visitLog?.id || null,
        ...rest,
      })
      .eq('id', immunization_record_id)
      .select()
      .single();

    if (error) throw error;

    // Resolve any VACCINE_OVERDUE alert for this record
    await supabase
      .from('alerts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('dedup_key', `VACCINE_OVERDUE:${immunization_record_id}`)
      .eq('status', 'active');

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/immunizations/:id
// ---------------------------------------------------------------------------
const updateImmunSchema = z.object({
  administered_date: z.string().optional(),
  batch_number: z.string().optional(),
  administration_site: z.string().optional(),
  adverse_reaction: z.string().optional(),
  notes: z.string().optional(),
});

router.patch('/:id', async (req, res, next) => {
  if (req.baseUrl !== '/api/immunizations') return next();

  try {
    const parsed = updateImmunSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { data, error } = await supabase
      .from('immunization_records')
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
