const express = require('express');
const { z } = require('zod');
const supabase = require('../utils/supabaseClient');
const logger = require('../utils/logger');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/members/:memberId/pregnancies
// ---------------------------------------------------------------------------
router.get('/:memberId/pregnancies', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('pregnancies')
      .select(`
        id, member_id, lmp_date, edd, edd_is_estimated, registration_date,
        status, current_risk_level, gravida, para,
        newborn_member_id, registered_by, created_at, updated_at
      `)
      .eq('member_id', req.params.memberId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/pregnancies — register new pregnancy
// ---------------------------------------------------------------------------
const registerSchema = z.object({
  member_id: z.string().uuid(),
  lmp_date: z.string().optional(),
  edd: z.string().optional(),
  edd_is_estimated: z.boolean().optional().default(false),
  gravida: z.number().int().min(1).optional(),
  para: z.number().int().min(0).optional(),
});

router.post('/', async (req, res, next) => {
  if (req.baseUrl !== '/api/pregnancies') return next();

  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { member_id, lmp_date, edd, ...rest } = parsed.data;

    // Calculate EDD from LMP if not provided
    let calculatedEdd = edd;
    if (!calculatedEdd && lmp_date) {
      const lmp = new Date(lmp_date);
      lmp.setDate(lmp.getDate() + 280); // Naegele's rule
      calculatedEdd = lmp.toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('pregnancies')
      .insert({
        member_id,
        lmp_date: lmp_date || null,
        edd: calculatedEdd || null,
        registered_by: req.user.id,
        ...rest,
      })
      .select()
      .single();

    if (error) throw error;

    // Update member's is_pregnant flag
    await supabase
      .from('members')
      .update({ is_pregnant: true })
      .eq('id', member_id);

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/pregnancies/:id — pregnancy with ANC visits
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res, next) => {
  if (req.baseUrl !== '/api/pregnancies') return next();

  try {
    const { data: pregnancy, error } = await supabase
      .from('pregnancies')
      .select(`
        id, member_id, lmp_date, edd, edd_is_estimated, registration_date,
        status, current_risk_level, gravida, para,
        newborn_member_id, registered_by, created_at, updated_at,
        members(id, full_name, date_of_birth, household_id, households(id, village_id, malaria_number))
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !pregnancy) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Pregnancy not found.' },
      });
    }

    // Fetch ANC visits with visit_logs
    const { data: ancVisits } = await supabase
      .from('anc_visits')
      .select(`
        id, pregnancy_id, gestational_age_weeks, weight_kg,
        bp_systolic, bp_diastolic, hemoglobin_gdl, blood_group, rh_factor,
        blood_sugar_fasting_mgdl, blood_sugar_ppbs_mgdl,
        urine_protein, urine_sugar, ultrasound_done, ultrasound_type,
        ultrasound_findings, tt_td_dose_number, ifa_tablets_given,
        calcium_tablets_given, risk_level, risk_notes,
        created_at, updated_at,
        visit_logs(id, visit_date, visit_time, conducted_by, doctor_notes, next_visit_due)
      `)
      .eq('pregnancy_id', req.params.id)
      .order('created_at', { ascending: false });

    // Fetch pregnancy outcome
    const { data: outcome } = await supabase
      .from('pregnancy_outcomes')
      .select('*')
      .eq('pregnancy_id', req.params.id)
      .single();

    // Fetch postnatal mother visits if delivered
    let postnatalMotherVisits = [];
    if (pregnancy.status === 'delivered') {
      const { data: pnVisits } = await supabase
        .from('postnatal_mother_visits')
        .select(`
          *, visit_logs(id, visit_date, visit_time, conducted_by, doctor_notes)
        `)
        .eq('pregnancy_id', req.params.id)
        .order('created_at', { ascending: false });
      postnatalMotherVisits = pnVisits || [];
    }

    // Fetch postnatal newborn visits if newborn exists
    let postnatalNewbornVisits = [];
    if (pregnancy.newborn_member_id) {
      const { data: nbVisits } = await supabase
        .from('postnatal_newborn_visits')
        .select(`
          *, visit_logs(id, visit_date, visit_time, conducted_by, doctor_notes)
        `)
        .eq('newborn_member_id', pregnancy.newborn_member_id)
        .order('created_at', { ascending: false });
      postnatalNewbornVisits = nbVisits || [];
    }

    res.json({
      ...pregnancy,
      ancVisits: ancVisits || [],
      outcome: outcome || null,
      postnatalMotherVisits,
      postnatalNewbornVisits,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/pregnancies/:id
// ---------------------------------------------------------------------------
const updatePregSchema = z.object({
  lmp_date: z.string().optional(),
  edd: z.string().optional(),
  edd_is_estimated: z.boolean().optional(),
  status: z.enum(['registered', 'anc_ongoing', 'delivered', 'complicated', 'terminated']).optional(),
  current_risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  gravida: z.number().int().optional(),
  para: z.number().int().optional(),
});

router.patch('/:id', async (req, res, next) => {
  if (req.baseUrl !== '/api/pregnancies') return next();

  try {
    const parsed = updatePregSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { data, error } = await supabase
      .from('pregnancies')
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

// ---------------------------------------------------------------------------
// POST /api/pregnancies/:id/anc-visits — log a new ANC visit
// ---------------------------------------------------------------------------
const ancVisitSchema = z.object({
  visit_date: z.string(),
  visit_time: z.string().optional(),
  gestational_age_weeks: z.number().int().min(0).max(45).optional(),
  weight_kg: z.number().positive().optional(),
  bp_systolic: z.number().int().positive().optional(),
  bp_diastolic: z.number().int().positive().optional(),
  hemoglobin_gdl: z.number().positive().optional(),
  blood_group: z.string().optional(),
  rh_factor: z.string().optional(),
  blood_sugar_fasting_mgdl: z.number().positive().optional(),
  blood_sugar_ppbs_mgdl: z.number().positive().optional(),
  urine_protein: z.enum(['negative', 'trace', 'plus_1', 'plus_2', 'plus_3']).optional(),
  urine_sugar: z.enum(['negative', 'trace', 'plus_1', 'plus_2', 'plus_3']).optional(),
  ultrasound_done: z.boolean().optional().default(false),
  ultrasound_type: z.string().optional(),
  ultrasound_findings: z.string().optional(),
  tt_td_dose_number: z.number().int().optional(),
  ifa_tablets_given: z.number().int().optional(),
  calcium_tablets_given: z.number().int().optional(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  risk_notes: z.string().optional(),
  doctor_notes: z.string().optional(),
  next_visit_due: z.string().optional(),
});

router.post('/:id/anc-visits', async (req, res, next) => {
  if (req.baseUrl !== '/api/pregnancies') return next();

  try {
    const parsed = ancVisitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const pregnancyId = req.params.id;

    // Fetch pregnancy to get member_id
    const { data: pregnancy } = await supabase
      .from('pregnancies')
      .select('id, member_id, status, current_risk_level, members(household_id, households(village_id))')
      .eq('id', pregnancyId)
      .single();

    if (!pregnancy) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Pregnancy not found.' },
      });
    }

    const {
      visit_date, visit_time, doctor_notes, next_visit_due,
      bp_systolic, bp_diastolic, hemoglobin_gdl,
      blood_sugar_fasting_mgdl, blood_sugar_ppbs_mgdl,
      ...ancFields
    } = parsed.data;

    // 1. Create visit_log
    const { data: visitLog, error: vlError } = await supabase
      .from('visit_logs')
      .insert({
        member_id: pregnancy.member_id,
        visit_type: 'anc',
        visit_date,
        visit_time: visit_time || null,
        conducted_by: req.user.id,
        doctor_notes: doctor_notes || null,
        next_visit_due: next_visit_due || null,
      })
      .select()
      .single();

    if (vlError) throw vlError;

    // 2. Evaluate risk level
    let computedRisk = ancFields.risk_level || pregnancy.current_risk_level || 'low';
    const riskReasons = [];

    if (bp_systolic && bp_systolic > 140) {
      computedRisk = 'high';
      riskReasons.push('High BP systolic');
    }
    if (bp_diastolic && bp_diastolic > 90) {
      computedRisk = 'high';
      riskReasons.push('High BP diastolic');
    }
    if (hemoglobin_gdl && hemoglobin_gdl < 11) {
      computedRisk = 'high';
      riskReasons.push('Low hemoglobin');
    }
    if (blood_sugar_fasting_mgdl && blood_sugar_fasting_mgdl > 95) {
      computedRisk = 'high';
      riskReasons.push('High fasting blood sugar');
    }
    if (blood_sugar_ppbs_mgdl && blood_sugar_ppbs_mgdl > 140) {
      computedRisk = 'high';
      riskReasons.push('High PPBS');
    }

    // 3. Create anc_visit
    const { data: ancVisit, error: avError } = await supabase
      .from('anc_visits')
      .insert({
        pregnancy_id: pregnancyId,
        visit_log_id: visitLog.id,
        bp_systolic: bp_systolic || null,
        bp_diastolic: bp_diastolic || null,
        hemoglobin_gdl: hemoglobin_gdl || null,
        blood_sugar_fasting_mgdl: blood_sugar_fasting_mgdl || null,
        blood_sugar_ppbs_mgdl: blood_sugar_ppbs_mgdl || null,
        risk_level: computedRisk,
        risk_notes: riskReasons.length > 0 ? riskReasons.join('; ') : (ancFields.risk_notes || null),
        ...ancFields,
      })
      .select()
      .single();

    if (avError) throw avError;

    // 4. Update pregnancy status and risk
    const updates = { current_risk_level: computedRisk };
    if (pregnancy.status === 'registered') {
      updates.status = 'anc_ongoing';
    }
    await supabase.from('pregnancies').update(updates).eq('id', pregnancyId);

    // 5. Create clinical alerts immediately if thresholds breached
    const villageId = pregnancy.members?.households?.village_id;
    if (riskReasons.length > 0 && villageId) {
      const alertInserts = [];

      if (bp_systolic > 140 || bp_diastolic > 90) {
        alertInserts.push({
          village_id: villageId,
          member_id: pregnancy.member_id,
          pregnancy_id: pregnancyId,
          alert_type: 'ANC_HIGH_BP',
          severity: 'critical',
          status: 'active',
          title: 'High Blood Pressure Detected',
          description: `BP: ${bp_systolic || '-'}/${bp_diastolic || '-'} mmHg`,
          dedup_key: `ANC_HIGH_BP:${pregnancyId}`,
        });
      }

      if (hemoglobin_gdl && hemoglobin_gdl < 11) {
        alertInserts.push({
          village_id: villageId,
          member_id: pregnancy.member_id,
          pregnancy_id: pregnancyId,
          alert_type: 'ANC_LOW_HB',
          severity: 'high',
          status: 'active',
          title: 'Low Hemoglobin Detected',
          description: `Hemoglobin: ${hemoglobin_gdl} g/dL`,
          dedup_key: `ANC_LOW_HB:${pregnancyId}`,
        });
      }

      if ((blood_sugar_fasting_mgdl && blood_sugar_fasting_mgdl > 95) ||
          (blood_sugar_ppbs_mgdl && blood_sugar_ppbs_mgdl > 140)) {
        alertInserts.push({
          village_id: villageId,
          member_id: pregnancy.member_id,
          pregnancy_id: pregnancyId,
          alert_type: 'ANC_HIGH_BS',
          severity: 'high',
          status: 'active',
          title: 'High Blood Sugar Detected',
          description: `Fasting: ${blood_sugar_fasting_mgdl || '-'} mg/dL, PPBS: ${blood_sugar_ppbs_mgdl || '-'} mg/dL`,
          dedup_key: `ANC_HIGH_BS:${pregnancyId}`,
        });
      }

      for (const alert of alertInserts) {
        await supabase
          .from('alerts')
          .upsert(alert, { onConflict: 'dedup_key,status' })
          .select();
      }
    }

    res.status(201).json({
      visitLog,
      ancVisit,
      riskLevel: computedRisk,
      riskReasons,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/pregnancies/:id/anc-visits/:visitId
// ---------------------------------------------------------------------------
router.patch('/:id/anc-visits/:visitId', async (req, res, next) => {
  if (req.baseUrl !== '/api/pregnancies') return next();

  try {
    const { doctor_notes, next_visit_due, ...ancFields } = req.body;

    // Update visit_log if needed
    if (doctor_notes !== undefined || next_visit_due !== undefined) {
      const vlUpdate = {};
      if (doctor_notes !== undefined) vlUpdate.doctor_notes = doctor_notes;
      if (next_visit_due !== undefined) vlUpdate.next_visit_due = next_visit_due;

      const { data: ancVisit } = await supabase
        .from('anc_visits')
        .select('visit_log_id')
        .eq('id', req.params.visitId)
        .single();

      if (ancVisit) {
        await supabase.from('visit_logs').update(vlUpdate).eq('id', ancVisit.visit_log_id);
      }
    }

    // Update anc_visit
    if (Object.keys(ancFields).length > 0) {
      const { data, error } = await supabase
        .from('anc_visits')
        .update(ancFields)
        .eq('id', req.params.visitId)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } else {
      res.json({ message: 'Updated.' });
    }
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/pregnancies/:id/outcome — record delivery/term/complication
// ---------------------------------------------------------------------------
const outcomeSchema = z.object({
  outcome_type: z.enum(['normal_delivery', 'c_section', 'complication', 'miscarriage', 'mtp', 'stillbirth']),
  outcome_date: z.string(),
  delivery_location: z.string().optional(),
  delivery_attendant: z.string().optional(),
  maternal_complications: z.string().optional(),
  termination_reason: z.string().optional(),
  stillbirth_notes: z.string().optional(),
});

router.post('/:id/outcome', async (req, res, next) => {
  if (req.baseUrl !== '/api/pregnancies') return next();

  try {
    const parsed = outcomeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const pregnancyId = req.params.id;
    const { outcome_type, outcome_date, ...outcomeFields } = parsed.data;

    // Fetch pregnancy
    const { data: pregnancy } = await supabase
      .from('pregnancies')
      .select('id, member_id, members(id, full_name, household_id, households(village_id))')
      .eq('id', pregnancyId)
      .single();

    if (!pregnancy) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Pregnancy not found.' },
      });
    }

    // Insert outcome
    const { data: outcome, error: oError } = await supabase
      .from('pregnancy_outcomes')
      .insert({
        pregnancy_id: pregnancyId,
        outcome_type,
        outcome_date,
        recorded_by: req.user.id,
        ...outcomeFields,
      })
      .select()
      .single();

    if (oError) {
      if (oError.code === '23505') {
        return res.status(409).json({
          error: { code: 'DUPLICATE', message: 'An outcome has already been recorded for this pregnancy.' },
        });
      }
      throw oError;
    }

    // Process based on outcome type
    if (outcome_type === 'normal_delivery' || outcome_type === 'c_section') {
      // 1. Set pregnancy status to delivered
      await supabase.from('pregnancies').update({ status: 'delivered' }).eq('id', pregnancyId);

      const motherName = pregnancy.members?.full_name || 'Unknown';
      const householdId = pregnancy.members?.household_id;

      // 2. Create newborn member
      const { data: newborn } = await supabase
        .from('members')
        .insert({
          household_id: householdId,
          full_name: `Baby of ${motherName}`,
          name_finalized: false,
          gender: 'unknown',
          date_of_birth: outcome_date,
          is_newborn: true,
          birth_mother_id: pregnancy.member_id,
          created_by: req.user.id,
        })
        .select()
        .single();

      if (newborn) {
        // 3. Create relationships
        await supabase.from('household_relationships').insert([
          {
            household_id: householdId,
            member_id: pregnancy.member_id,
            related_member_id: newborn.id,
            relationship_type: 'child',
            created_by: req.user.id,
          },
          {
            household_id: householdId,
            member_id: newborn.id,
            related_member_id: pregnancy.member_id,
            relationship_type: 'parent',
            created_by: req.user.id,
          },
        ]);

        // 4. Update pregnancy with newborn_member_id
        await supabase.from('pregnancies').update({ newborn_member_id: newborn.id }).eq('id', pregnancyId);

        // 5. Generate immunization schedule
        const { data: vaccines } = await supabase.from('vaccines').select('id, target_age_days');

        if (vaccines && vaccines.length > 0) {
          const immunRecords = vaccines.map((v) => {
            const scheduledDate = new Date(outcome_date);
            scheduledDate.setDate(scheduledDate.getDate() + (v.target_age_days || 0));
            return {
              member_id: newborn.id,
              vaccine_id: v.id,
              scheduled_date: scheduledDate.toISOString().split('T')[0],
            };
          });

          await supabase.from('immunization_records').insert(immunRecords);
        }
      }

      // 6. Set mother's is_pregnant to false
      await supabase.from('members').update({ is_pregnant: false }).eq('id', pregnancy.member_id);

    } else if (outcome_type === 'complication') {
      await supabase.from('pregnancies').update({ status: 'complicated' }).eq('id', pregnancyId);
    } else {
      // miscarriage, mtp, stillbirth
      await supabase.from('pregnancies').update({ status: 'terminated' }).eq('id', pregnancyId);
      await supabase.from('members').update({ is_pregnant: false }).eq('id', pregnancy.member_id);
    }

    res.status(201).json(outcome);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
