const express = require('express');
const { z } = require('zod');
const supabase = require('../utils/supabaseClient');

const router = express.Router();

// ---------------------------------------------------------------------------
// POST /api/households/:id/relationships
// ---------------------------------------------------------------------------
const createRelSchema = z.object({
  member_id: z.string().uuid('Valid member ID is required'),
  related_member_id: z.string().uuid('Valid related member ID is required'),
  relationship_type: z.enum(['spouse', 'child', 'parent', 'sibling', 'grandparent', 'grandchild', 'other']),
});

router.post('/:id/relationships', async (req, res, next) => {
  try {
    const parsed = createRelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const householdId = req.params.id;
    const { member_id, related_member_id, relationship_type } = parsed.data;

    if (member_id === related_member_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Cannot create a relationship between a member and themselves.' },
      });
    }

    // Insert forward
    const { data, error } = await supabase
      .from('household_relationships')
      .insert({
        household_id: householdId,
        member_id,
        related_member_id,
        relationship_type,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error: { code: 'DUPLICATE', message: 'This relationship already exists.' },
        });
      }
      throw error;
    }

    // Insert reverse
    const reverseMap = {
      parent: 'child', child: 'parent', spouse: 'spouse',
      sibling: 'sibling', grandparent: 'grandchild', grandchild: 'grandparent', other: 'other',
    };

    await supabase
      .from('household_relationships')
      .insert({
        household_id: householdId,
        member_id: related_member_id,
        related_member_id: member_id,
        relationship_type: reverseMap[relationship_type],
        created_by: req.user.id,
      })
      .select();

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/relationships/:id  (also mounted under /api/households)
// ---------------------------------------------------------------------------
router.delete('/relationships/:relId', async (req, res, next) => {
  try {
    // Fetch the relationship to delete the reverse
    const { data: rel } = await supabase
      .from('household_relationships')
      .select('id, member_id, related_member_id, relationship_type')
      .eq('id', req.params.relId)
      .single();

    if (!rel) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Relationship not found.' },
      });
    }

    // Delete forward
    await supabase.from('household_relationships').delete().eq('id', req.params.relId);

    // Delete reverse
    const reverseMap = {
      parent: 'child', child: 'parent', spouse: 'spouse',
      sibling: 'sibling', grandparent: 'grandchild', grandchild: 'grandparent', other: 'other',
    };

    await supabase
      .from('household_relationships')
      .delete()
      .eq('member_id', rel.related_member_id)
      .eq('related_member_id', rel.member_id)
      .eq('relationship_type', reverseMap[rel.relationship_type]);

    res.json({ message: 'Relationship deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
