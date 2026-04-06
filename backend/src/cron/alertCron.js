const cron = require('node-cron');
const supabase = require('../utils/supabaseClient');
const logger = require('../utils/logger');

async function runAlertChecks() {
  logger.info('Alert cron: starting checks');
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  try {
    // -----------------------------------------------------------------------
    // 1. ANC_MISSED: Missed ANC visits for active pregnancies
    // -----------------------------------------------------------------------
    const { data: activePregs } = await supabase
      .from('pregnancies')
      .select(`
        id, member_id, current_risk_level, status,
        members(full_name, household_id, households(village_id))
      `)
      .in('status', ['registered', 'anc_ongoing']);

    for (const preg of (activePregs || [])) {
      const villageId = preg.members?.households?.village_id;
      if (!villageId) continue;

      // Find most recent ANC visit
      const { data: latestVisit } = await supabase
        .from('anc_visits')
        .select('visit_logs(visit_date)')
        .eq('pregnancy_id', preg.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastVisitDate = latestVisit?.[0]?.visit_logs?.visit_date;
      if (!lastVisitDate) {
        // Check if registered for over 35 days with no visit
        const { data: pregRec } = await supabase.from('pregnancies').select('registration_date').eq('id', preg.id).single();
        if (pregRec) {
          const daysSinceReg = Math.floor((now - new Date(pregRec.registration_date)) / 86400000);
          if (daysSinceReg > 35) {
            await upsertAlert({
              village_id: villageId,
              member_id: preg.member_id,
              pregnancy_id: preg.id,
              alert_type: 'ANC_MISSED',
              severity: 'high',
              title: `ANC visit overdue for ${preg.members?.full_name || 'Unknown'}`,
              description: `No ANC visit recorded since registration (${daysSinceReg} days ago).`,
              dedup_key: `ANC_MISSED:${preg.id}`,
            });
          }
        }
        continue;
      }

      const daysSinceVisit = Math.floor((now - new Date(lastVisitDate)) / 86400000);
      const threshold = (preg.current_risk_level === 'high' || preg.current_risk_level === 'critical') ? 14 : 35;

      if (daysSinceVisit > threshold) {
        await upsertAlert({
          village_id: villageId,
          member_id: preg.member_id,
          pregnancy_id: preg.id,
          alert_type: 'ANC_MISSED',
          severity: 'high',
          title: `ANC visit overdue for ${preg.members?.full_name || 'Unknown'}`,
          description: `Last ANC visit was ${daysSinceVisit} days ago. Risk level: ${preg.current_risk_level}.`,
          dedup_key: `ANC_MISSED:${preg.id}`,
        });
      } else {
        // Resolve if condition no longer true
        await resolveAlert(`ANC_MISSED:${preg.id}`);
      }
    }

    // -----------------------------------------------------------------------
    // 2. ANC_HIGH_BP, ANC_LOW_HB, ANC_HIGH_BS: from latest ANC visit
    // -----------------------------------------------------------------------
    for (const preg of (activePregs || [])) {
      const villageId = preg.members?.households?.village_id;
      if (!villageId) continue;

      const { data: latestAnc } = await supabase
        .from('anc_visits')
        .select('bp_systolic, bp_diastolic, hemoglobin_gdl, blood_sugar_fasting_mgdl, blood_sugar_ppbs_mgdl')
        .eq('pregnancy_id', preg.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!latestAnc) continue;

      // High BP
      if (latestAnc.bp_systolic > 140 || latestAnc.bp_diastolic > 90) {
        await upsertAlert({
          village_id: villageId, member_id: preg.member_id, pregnancy_id: preg.id,
          alert_type: 'ANC_HIGH_BP', severity: 'critical',
          title: `High BP: ${preg.members?.full_name || 'Unknown'}`,
          description: `BP: ${latestAnc.bp_systolic}/${latestAnc.bp_diastolic} mmHg`,
          dedup_key: `ANC_HIGH_BP:${preg.id}`,
        });
      } else {
        await resolveAlert(`ANC_HIGH_BP:${preg.id}`);
      }

      // Low Hb
      if (latestAnc.hemoglobin_gdl && latestAnc.hemoglobin_gdl < 11) {
        await upsertAlert({
          village_id: villageId, member_id: preg.member_id, pregnancy_id: preg.id,
          alert_type: 'ANC_LOW_HB', severity: 'high',
          title: `Low Hemoglobin: ${preg.members?.full_name || 'Unknown'}`,
          description: `Hemoglobin: ${latestAnc.hemoglobin_gdl} g/dL`,
          dedup_key: `ANC_LOW_HB:${preg.id}`,
        });
      } else {
        await resolveAlert(`ANC_LOW_HB:${preg.id}`);
      }

      // High BS
      if ((latestAnc.blood_sugar_fasting_mgdl && latestAnc.blood_sugar_fasting_mgdl > 95) ||
          (latestAnc.blood_sugar_ppbs_mgdl && latestAnc.blood_sugar_ppbs_mgdl > 140)) {
        await upsertAlert({
          village_id: villageId, member_id: preg.member_id, pregnancy_id: preg.id,
          alert_type: 'ANC_HIGH_BS', severity: 'high',
          title: `High Blood Sugar: ${preg.members?.full_name || 'Unknown'}`,
          description: `Fasting: ${latestAnc.blood_sugar_fasting_mgdl || '-'}, PPBS: ${latestAnc.blood_sugar_ppbs_mgdl || '-'} mg/dL`,
          dedup_key: `ANC_HIGH_BS:${preg.id}`,
        });
      } else {
        await resolveAlert(`ANC_HIGH_BS:${preg.id}`);
      }
    }

    // -----------------------------------------------------------------------
    // 3. PNC_MISSED_MOTHER
    // -----------------------------------------------------------------------
    const fortyTwoDaysAgo = new Date(now - 42 * 86400000).toISOString().split('T')[0];
    const { data: deliveredPregs } = await supabase
      .from('pregnancies')
      .select(`
        id, member_id, status,
        pregnancy_outcomes(outcome_date),
        members(full_name, household_id, households(village_id))
      `)
      .eq('status', 'delivered');

    for (const preg of (deliveredPregs || [])) {
      const outcomeDate = preg.pregnancy_outcomes?.[0]?.outcome_date;
      if (!outcomeDate) continue;

      const daysSinceDelivery = Math.floor((now - new Date(outcomeDate)) / 86400000);
      if (daysSinceDelivery > 42) continue;

      const villageId = preg.members?.households?.village_id;
      if (!villageId) continue;

      const checkpoints = [2, 7, 14, 42];
      const { data: pnVisits } = await supabase
        .from('postnatal_mother_visits')
        .select('days_postpartum')
        .eq('pregnancy_id', preg.id);

      const visitedDays = (pnVisits || []).map((v) => v.days_postpartum);

      for (const cp of checkpoints) {
        if (daysSinceDelivery >= cp + 3 && !visitedDays.some((d) => Math.abs(d - cp) <= 3)) {
          await upsertAlert({
            village_id: villageId, member_id: preg.member_id, pregnancy_id: preg.id,
            alert_type: 'PNC_MISSED_MOTHER', severity: 'high',
            title: `Postnatal visit overdue (Day ${cp}): ${preg.members?.full_name || 'Unknown'}`,
            description: `Postnatal mother visit at Day ${cp} is overdue.`,
            dedup_key: `PNC_MISSED_MOTHER:${preg.id}`,
          });
          break;
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. PNC_MISSED_NEWBORN
    // -----------------------------------------------------------------------
    const twentyEightDaysAgo = new Date(now - 28 * 86400000).toISOString().split('T')[0];
    const { data: newborns } = await supabase
      .from('members')
      .select('id, full_name, date_of_birth, household_id, households(village_id)')
      .eq('is_newborn', true)
      .eq('is_deleted', false)
      .gte('date_of_birth', twentyEightDaysAgo);

    for (const nb of (newborns || [])) {
      if (!nb.date_of_birth) continue;
      const daysOld = Math.floor((now - new Date(nb.date_of_birth)) / 86400000);
      const villageId = nb.households?.village_id;
      if (!villageId) continue;

      const checkpoints = [1, 3, 7, 28];
      const { data: nbVisits } = await supabase
        .from('postnatal_newborn_visits')
        .select('days_postnatal')
        .eq('newborn_member_id', nb.id);

      const visitedDays = (nbVisits || []).map((v) => v.days_postnatal);

      for (const cp of checkpoints) {
        if (daysOld >= cp + 3 && !visitedDays.some((d) => Math.abs(d - cp) <= 3)) {
          await upsertAlert({
            village_id: villageId, member_id: nb.id,
            alert_type: 'PNC_MISSED_NEWBORN', severity: 'high',
            title: `Newborn visit overdue (Day ${cp}): ${nb.full_name}`,
            description: `Postnatal newborn visit at Day ${cp} is overdue.`,
            dedup_key: `PNC_MISSED_NEWBORN:${nb.id}`,
          });
          break;
        }
      }
    }

    // -----------------------------------------------------------------------
    // 5. VACCINE_OVERDUE
    // -----------------------------------------------------------------------
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString().split('T')[0];
    const { data: overdueVacs } = await supabase
      .from('immunization_records')
      .select(`
        id, member_id, scheduled_date,
        vaccines(name),
        members(full_name, household_id, households(village_id))
      `)
      .is('administered_date', null)
      .lt('scheduled_date', sevenDaysAgo);

    for (const vac of (overdueVacs || [])) {
      const villageId = vac.members?.households?.village_id;
      if (!villageId) continue;

      // Set is_overdue
      await supabase.from('immunization_records').update({ is_overdue: true }).eq('id', vac.id);

      await upsertAlert({
        village_id: villageId, member_id: vac.member_id,
        alert_type: 'VACCINE_OVERDUE', severity: 'medium',
        title: `Vaccine overdue: ${vac.vaccines?.name || 'Unknown'} for ${vac.members?.full_name || 'Unknown'}`,
        description: `Scheduled for ${vac.scheduled_date}, now overdue.`,
        dedup_key: `VACCINE_OVERDUE:${vac.id}`,
      });
    }

    // -----------------------------------------------------------------------
    // 6. PREGNANCY_OVERDUE
    // -----------------------------------------------------------------------
    const { data: overduePregs } = await supabase
      .from('pregnancies')
      .select(`
        id, member_id, edd,
        members(full_name, household_id, households(village_id))
      `)
      .lt('edd', todayStr)
      .in('status', ['registered', 'anc_ongoing']);

    for (const preg of (overduePregs || [])) {
      const villageId = preg.members?.households?.village_id;
      if (!villageId) continue;

      await upsertAlert({
        village_id: villageId, member_id: preg.member_id, pregnancy_id: preg.id,
        alert_type: 'PREGNANCY_OVERDUE', severity: 'critical',
        title: `Pregnancy overdue: ${preg.members?.full_name || 'Unknown'}`,
        description: `EDD was ${preg.edd}. No outcome recorded.`,
        dedup_key: `PREGNANCY_OVERDUE:${preg.id}`,
      });
    }

    // -----------------------------------------------------------------------
    // 7. Resolve alerts whose conditions are now false
    // -----------------------------------------------------------------------
    // Resolve VACCINE_OVERDUE for administered vaccines
    const { data: activeVaccAlerts } = await supabase
      .from('alerts')
      .select('id, dedup_key')
      .eq('alert_type', 'VACCINE_OVERDUE')
      .eq('status', 'active');

    for (const alert of (activeVaccAlerts || [])) {
      const recId = alert.dedup_key.replace('VACCINE_OVERDUE:', '');
      const { data: rec } = await supabase
        .from('immunization_records')
        .select('administered_date')
        .eq('id', recId)
        .single();

      if (rec?.administered_date) {
        await resolveAlert(alert.dedup_key);
      }
    }

    // Resolve PREGNANCY_OVERDUE for pregnancies that now have outcomes
    const { data: activePregOverdueAlerts } = await supabase
      .from('alerts')
      .select('id, dedup_key, pregnancy_id')
      .eq('alert_type', 'PREGNANCY_OVERDUE')
      .eq('status', 'active');

    for (const alert of (activePregOverdueAlerts || [])) {
      if (alert.pregnancy_id) {
        const { data: p } = await supabase
          .from('pregnancies')
          .select('status')
          .eq('id', alert.pregnancy_id)
          .single();

        if (p && ['delivered', 'terminated', 'complicated'].includes(p.status)) {
          await resolveAlert(alert.dedup_key);
        }
      }
    }

    logger.info('Alert cron: checks completed');
  } catch (err) {
    logger.error('Alert cron failed', { error: err.message, stack: err.stack });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function upsertAlert(alertData) {
  try {
    await supabase
      .from('alerts')
      .upsert({
        ...alertData,
        status: 'active',
      }, { onConflict: 'dedup_key,status' });
  } catch (err) {
    logger.error('Failed to upsert alert', { dedup_key: alertData.dedup_key, error: err.message });
  }
}

async function resolveAlert(dedupKey) {
  try {
    await supabase
      .from('alerts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('dedup_key', dedupKey)
      .eq('status', 'active');
  } catch (err) {
    // Ignore — alert may not exist
  }
}

function initAlertCron() {
  // Run every 6 hours
  cron.schedule('0 */6 * * *', () => {
    runAlertChecks();
  });

  logger.info('Alert cron scheduled: every 6 hours');

  // Run once on startup (after a short delay)
  setTimeout(() => {
    runAlertChecks();
  }, 5000);
}

module.exports = { initAlertCron, runAlertChecks };
