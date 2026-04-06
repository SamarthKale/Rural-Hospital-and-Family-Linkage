const express = require('express');
const { z } = require('zod');
const supabase = require('../utils/supabaseClient');
const logger = require('../utils/logger');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/members/:id — full profile
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res, next) => {
  // Skip if this looks like a sub-resource route handled by other routers
  if (['pregnancies', 'immunizations', 'illness-logs'].some(s => req.params.id === s)) {
    return next();
  }

  try {
    const { data: member, error } = await supabase
      .from('members')
      .select(`
        id, household_id, full_name, name_finalized, date_of_birth,
        age_years_estimated, gender, phone, email, blood_group,
        known_allergies, disability_status, marital_status, occupation,
        is_pregnant, has_chronic_illness, is_newborn, birth_mother_id,
        is_deleted, created_at, updated_at,
        households(id, village_id, malaria_number, house_number)
      `)
      .eq('id', req.params.id)
      .eq('is_deleted', false)
      .single();

    if (error || !member) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Member not found.' },
      });
    }

    // Check village scope
    if (req.allowedVillageIds !== null && !req.allowedVillageIds.includes(member.households?.village_id)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have access to this member.' },
      });
    }

    // Active illness logs
    const { data: illnesses } = await supabase
      .from('illness_logs')
      .select('id, illness_name, icd10_code, onset_date, resolved_date, is_chronic, notes')
      .eq('member_id', req.params.id)
      .is('resolved_date', null)
      .order('onset_date', { ascending: false });

    // Active medications via illness logs
    const activeIllnessIds = (illnesses || []).map((i) => i.id);
    let medications = [];
    if (activeIllnessIds.length > 0) {
      const { data: meds } = await supabase
        .from('medications')
        .select('id, drug_name, dose, frequency, duration_days, start_date, end_date')
        .in('illness_log_id', activeIllnessIds);
      medications = meds || [];
    }

    // Pregnancy status (if female)
    let activePregnancy = null;
    if (member.gender === 'female' && member.is_pregnant) {
      const { data: preg } = await supabase
        .from('pregnancies')
        .select('id, lmp_date, edd, status, current_risk_level, gravida, para, registration_date')
        .eq('member_id', req.params.id)
        .in('status', ['registered', 'anc_ongoing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      activePregnancy = preg;
    }

    res.json({
      ...member,
      activeIllnesses: illnesses || [],
      activeMedications: medications,
      activePregnancy,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/members
// ---------------------------------------------------------------------------
const createMemberSchema = z.object({
  household_id: z.string().uuid('Valid household ID is required'),
  full_name: z.string().min(1, 'Full name is required'),
  date_of_birth: z.string().optional(),
  age_years_estimated: z.number().int().min(0).optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  blood_group: z.string().optional(),
  known_allergies: z.string().optional(),
  disability_status: z.string().optional(),
  marital_status: z.string().optional(),
  occupation: z.string().optional(),
  is_newborn: z.boolean().optional().default(false),
  birth_mother_id: z.string().uuid().optional(),
  pregnancy_id: z.string().uuid().optional(),
  relationship: z.object({
    related_member_id: z.string().uuid(),
    relationship_type: z.enum(['spouse', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other']),
  }).optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = createMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { relationship, pregnancy_id, ...memberData } = parsed.data;

    if (memberData.is_newborn && !memberData.birth_mother_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'birth_mother_id is required for newborn members.' },
      });
    }

    // Check household access
    const { data: household } = await supabase
      .from('households')
      .select('id, village_id')
      .eq('id', memberData.household_id)
      .single();

    if (!household) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Household not found.' },
      });
    }

    if (req.allowedVillageIds !== null && !req.allowedVillageIds.includes(household.village_id)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have access to this household.' },
      });
    }

    const insertData = {
      ...memberData,
      created_by: req.user.id,
    };

    const { data: newMember, error } = await supabase
      .from('members')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Create relationship if provided
    if (relationship) {
      await supabase.from('household_relationships').insert({
        household_id: memberData.household_id,
        member_id: relationship.related_member_id,
        related_member_id: newMember.id,
        relationship_type: relationship.relationship_type,
        created_by: req.user.id,
      });

      // Create reverse relationship
      const reverseMap = {
        parent: 'child', child: 'parent', spouse: 'spouse',
        sibling: 'sibling', grandparent: 'grandchild', grandchild: 'grandparent', other: 'other',
      };
      await supabase.from('household_relationships').insert({
        household_id: memberData.household_id,
        member_id: newMember.id,
        related_member_id: relationship.related_member_id,
        relationship_type: reverseMap[relationship.relationship_type],
        created_by: req.user.id,
      });
    }

    res.status(201).json(newMember);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/members/:id
// ---------------------------------------------------------------------------
const updateMemberSchema = z.object({
  full_name: z.string().min(1).optional(),
  name_finalized: z.boolean().optional(),
  date_of_birth: z.string().optional(),
  age_years_estimated: z.number().int().min(0).optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  blood_group: z.string().optional(),
  known_allergies: z.string().optional(),
  disability_status: z.string().optional(),
  marital_status: z.string().optional(),
  occupation: z.string().optional(),
});

router.patch('/:id', async (req, res, next) => {
  if (['pregnancies', 'immunizations', 'illness-logs'].some(s => req.params.id === s)) {
    return next();
  }

  try {
    const parsed = updateMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { data, error } = await supabase
      .from('members')
      .update(parsed.data)
      .eq('id', req.params.id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Member not found.' },
      });
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/members/:id (soft delete)
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('members')
      .update({ is_deleted: true })
      .eq('id', req.params.id)
      .select('id')
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Member not found.' },
      });
    }

    res.json({ message: 'Member soft-deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
