import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Baby, ChevronRight, Heart, Activity, Calendar,
  AlertTriangle, Plus, FileText, CheckCircle, Clock,
  Stethoscope
} from 'lucide-react';
import { usePregnancyDetail, useLogAncVisit, useRecordOutcome } from '../hooks/useApi';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import DatePicker from '../components/common/DatePicker';
import Textarea from '../components/common/Textarea';
import EmptyState from '../components/common/EmptyState';
import { formatDate, gestationalWeeks, pregnancyStatusDisplay, riskBadgeVariant } from '../utils/helpers';

export default function PregnancyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: pregnancy, isLoading } = usePregnancyDetail(id);

  const [showAncModal, setShowAncModal] = useState(false);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);

  const logAnc = useLogAncVisit();
  const recordOutcome = useRecordOutcome();

  // ANC form
  const [ancForm, setAncForm] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    gestational_age_weeks: '',
    weight_kg: '',
    bp_systolic: '', bp_diastolic: '',
    hemoglobin_gdl: '',
    blood_sugar_fasting_mgdl: '', blood_sugar_ppbs_mgdl: '',
    urine_protein: '', urine_sugar: '',
    ifa_tablets_given: '', calcium_tablets_given: '',
    doctor_notes: '', next_visit_due: '',
  });

  // Outcome form
  const [outcomeForm, setOutcomeForm] = useState({
    outcome_type: '',
    outcome_date: new Date().toISOString().split('T')[0],
    delivery_location: '', delivery_attendant: '',
    maternal_complications: '',
  });

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  if (!pregnancy) {
    return <EmptyState icon={Baby} title="Pregnancy not found" />;
  }

  const ga = gestationalWeeks(pregnancy.lmp_date, pregnancy.edd);
  const memberName = pregnancy.members?.full_name || 'Unknown';
  const isActive = ['registered', 'anc_ongoing'].includes(pregnancy.status);

  const handleAncSubmit = async () => {
    try {
      const payload = { pregnancyId: id };
      Object.entries(ancForm).forEach(([k, v]) => {
        if (v !== '' && v !== undefined) {
          const numFields = ['gestational_age_weeks', 'weight_kg', 'bp_systolic', 'bp_diastolic',
            'hemoglobin_gdl', 'blood_sugar_fasting_mgdl', 'blood_sugar_ppbs_mgdl',
            'ifa_tablets_given', 'calcium_tablets_given'];
          payload[k] = numFields.includes(k) ? parseFloat(v) : v;
        }
      });
      await logAnc.mutateAsync(payload);
      setShowAncModal(false);
    } catch (_) {}
  };

  const handleOutcomeSubmit = async () => {
    try {
      await recordOutcome.mutateAsync({ pregnancyId: id, ...outcomeForm });
      setShowOutcomeModal(false);
    } catch (_) {}
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500 flex-wrap">
        <button onClick={() => navigate('/households')} className="hover:text-primary transition-colors">Households</button>
        <ChevronRight className="w-3.5 h-3.5" />
        <button onClick={() => navigate(`/members/${pregnancy.member_id}`)} className="hover:text-primary transition-colors">
          {memberName}
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-neutral-800 font-medium">Pregnancy</span>
      </div>

      {/* Header Card */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-pink-500 via-pink-600 to-purple-600 px-6 py-5 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <Baby className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{memberName}</h1>
              <p className="text-sm text-white/80">
                {pregnancyStatusDisplay(pregnancy.status)}
                {pregnancy.gravida && ` · G${pregnancy.gravida}P${pregnancy.para || 0}`}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
          <div className="text-center p-3 bg-neutral-50 rounded-lg">
            <p className="text-lg font-bold text-neutral-800">{ga?.display || '—'}</p>
            <p className="text-xs text-neutral-500">Gestational Age</p>
          </div>
          <div className="text-center p-3 bg-neutral-50 rounded-lg">
            <p className="text-lg font-bold text-neutral-800">{formatDate(pregnancy.edd)}</p>
            <p className="text-xs text-neutral-500">EDD</p>
          </div>
          <div className="text-center p-3 bg-neutral-50 rounded-lg">
            <Badge variant={riskBadgeVariant(pregnancy.current_risk_level)} dot>
              {pregnancy.current_risk_level}
            </Badge>
            <p className="text-xs text-neutral-500 mt-1">Risk Level</p>
          </div>
          <div className="text-center p-3 bg-neutral-50 rounded-lg">
            <p className="text-lg font-bold text-neutral-800">{pregnancy.ancVisits?.length || 0}</p>
            <p className="text-xs text-neutral-500">ANC Visits</p>
          </div>
        </div>

        {isActive && (
          <div className="flex gap-3 px-5 pb-5">
            <Button onClick={() => setShowAncModal(true)} size="sm">
              <Plus className="w-3.5 h-3.5" /> Log ANC Visit
            </Button>
            <Button variant="secondary" onClick={() => setShowOutcomeModal(true)} size="sm">
              <FileText className="w-3.5 h-3.5" /> Record Outcome
            </Button>
          </div>
        )}
      </div>

      {/* Outcome */}
      {pregnancy.outcome && (
        <div className="card p-5 border-l-4 border-l-success">
          <h3 className="text-sm font-semibold text-neutral-800 flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-success" /> Pregnancy Outcome
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-neutral-500 text-xs">Type</p>
              <p className="font-medium text-neutral-700 capitalize">{pregnancy.outcome.outcome_type?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Date</p>
              <p className="font-medium text-neutral-700">{formatDate(pregnancy.outcome.outcome_date)}</p>
            </div>
            {pregnancy.outcome.delivery_location && (
              <div>
                <p className="text-neutral-500 text-xs">Location</p>
                <p className="font-medium text-neutral-700">{pregnancy.outcome.delivery_location}</p>
              </div>
            )}
            {pregnancy.outcome.delivery_attendant && (
              <div>
                <p className="text-neutral-500 text-xs">Attendant</p>
                <p className="font-medium text-neutral-700">{pregnancy.outcome.delivery_attendant}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ANC Visit Timeline */}
      <div className="card">
        <div className="px-5 py-4 border-b border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            ANC Visit History
          </h2>
        </div>

        {!pregnancy.ancVisits || pregnancy.ancVisits.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No ANC visits recorded"
            description={isActive ? 'Log the first antenatal visit.' : 'This pregnancy had no ANC visits.'}
          />
        ) : (
          <div className="divide-y divide-neutral-100">
            {pregnancy.ancVisits.map((visit, idx) => (
              <div key={visit.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-xs font-bold text-primary">
                      {pregnancy.ancVisits.length - idx}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        ANC Visit #{pregnancy.ancVisits.length - idx}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatDate(visit.visit_logs?.visit_date)}
                        {visit.gestational_age_weeks && ` · Week ${visit.gestational_age_weeks}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant={riskBadgeVariant(visit.risk_level)}>{visit.risk_level}</Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {visit.weight_kg && (
                    <div>
                      <span className="text-neutral-400">Weight</span>
                      <p className="font-medium text-neutral-700">{visit.weight_kg} kg</p>
                    </div>
                  )}
                  {(visit.bp_systolic || visit.bp_diastolic) && (
                    <div>
                      <span className="text-neutral-400">BP</span>
                      <p className={`font-medium ${visit.bp_systolic > 140 || visit.bp_diastolic > 90 ? 'text-danger' : 'text-neutral-700'}`}>
                        {visit.bp_systolic}/{visit.bp_diastolic} mmHg
                      </p>
                    </div>
                  )}
                  {visit.hemoglobin_gdl && (
                    <div>
                      <span className="text-neutral-400">Hemoglobin</span>
                      <p className={`font-medium ${visit.hemoglobin_gdl < 11 ? 'text-danger' : 'text-neutral-700'}`}>
                        {visit.hemoglobin_gdl} g/dL
                      </p>
                    </div>
                  )}
                  {visit.ifa_tablets_given && (
                    <div>
                      <span className="text-neutral-400">IFA Tablets</span>
                      <p className="font-medium text-neutral-700">{visit.ifa_tablets_given}</p>
                    </div>
                  )}
                </div>

                {visit.risk_notes && (
                  <p className="text-xs text-danger mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {visit.risk_notes}
                  </p>
                )}

                {visit.visit_logs?.doctor_notes && (
                  <p className="text-xs text-neutral-500 mt-2 italic">{visit.visit_logs.doctor_notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ANC Visit Modal */}
      <Modal
        isOpen={showAncModal}
        onClose={() => setShowAncModal(false)}
        title="Log ANC Visit"
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAncModal(false)}>Cancel</Button>
            <Button onClick={handleAncSubmit} loading={logAnc.isPending}>Save Visit</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DatePicker label="Visit Date *" value={ancForm.visit_date} onChange={(e) => setAncForm({ ...ancForm, visit_date: e.target.value })} />
            <Input label="Gestational Weeks" type="number" value={ancForm.gestational_age_weeks} onChange={(e) => setAncForm({ ...ancForm, gestational_age_weeks: e.target.value })} />
            <Input label="Weight (kg)" type="number" step="0.1" value={ancForm.weight_kg} onChange={(e) => setAncForm({ ...ancForm, weight_kg: e.target.value })} />
          </div>

          <h4 className="text-sm font-medium text-neutral-700 border-b pb-1">Vitals</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Input label="BP Systolic" type="number" value={ancForm.bp_systolic} onChange={(e) => setAncForm({ ...ancForm, bp_systolic: e.target.value })} />
            <Input label="BP Diastolic" type="number" value={ancForm.bp_diastolic} onChange={(e) => setAncForm({ ...ancForm, bp_diastolic: e.target.value })} />
            <Input label="Hemoglobin (g/dL)" type="number" step="0.1" value={ancForm.hemoglobin_gdl} onChange={(e) => setAncForm({ ...ancForm, hemoglobin_gdl: e.target.value })} />
            <Input label="Fasting BS (mg/dL)" type="number" value={ancForm.blood_sugar_fasting_mgdl} onChange={(e) => setAncForm({ ...ancForm, blood_sugar_fasting_mgdl: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Input label="PPBS (mg/dL)" type="number" value={ancForm.blood_sugar_ppbs_mgdl} onChange={(e) => setAncForm({ ...ancForm, blood_sugar_ppbs_mgdl: e.target.value })} />
            <Select label="Urine Protein" options={[
              { value: 'negative', label: 'Negative' }, { value: 'trace', label: 'Trace' },
              { value: 'plus_1', label: '+1' }, { value: 'plus_2', label: '+2' }, { value: 'plus_3', label: '+3' },
            ]} value={ancForm.urine_protein} onChange={(e) => setAncForm({ ...ancForm, urine_protein: e.target.value })} />
            <Input label="IFA Tablets" type="number" value={ancForm.ifa_tablets_given} onChange={(e) => setAncForm({ ...ancForm, ifa_tablets_given: e.target.value })} />
            <Input label="Calcium Tablets" type="number" value={ancForm.calcium_tablets_given} onChange={(e) => setAncForm({ ...ancForm, calcium_tablets_given: e.target.value })} />
          </div>

          <Textarea label="Doctor Notes" value={ancForm.doctor_notes} onChange={(e) => setAncForm({ ...ancForm, doctor_notes: e.target.value })} rows={2} />
          <DatePicker label="Next Visit Due" value={ancForm.next_visit_due} onChange={(e) => setAncForm({ ...ancForm, next_visit_due: e.target.value })} />
        </div>
      </Modal>

      {/* Outcome Modal */}
      <Modal
        isOpen={showOutcomeModal}
        onClose={() => setShowOutcomeModal(false)}
        title="Record Pregnancy Outcome"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowOutcomeModal(false)}>Cancel</Button>
            <Button onClick={handleOutcomeSubmit} loading={recordOutcome.isPending}>Record</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Outcome Type *"
            options={[
              { value: 'normal_delivery', label: 'Normal Delivery' },
              { value: 'c_section', label: 'C-Section' },
              { value: 'complication', label: 'Complication' },
              { value: 'miscarriage', label: 'Miscarriage' },
              { value: 'mtp', label: 'MTP' },
              { value: 'stillbirth', label: 'Stillbirth' },
            ]}
            value={outcomeForm.outcome_type}
            onChange={(e) => setOutcomeForm({ ...outcomeForm, outcome_type: e.target.value })}
          />
          <DatePicker label="Outcome Date *" value={outcomeForm.outcome_date} onChange={(e) => setOutcomeForm({ ...outcomeForm, outcome_date: e.target.value })} />
          <Input label="Delivery Location" value={outcomeForm.delivery_location} onChange={(e) => setOutcomeForm({ ...outcomeForm, delivery_location: e.target.value })} placeholder="e.g., PHC, District Hospital" />
          <Input label="Delivery Attendant" value={outcomeForm.delivery_attendant} onChange={(e) => setOutcomeForm({ ...outcomeForm, delivery_attendant: e.target.value })} />
          <Textarea label="Complications (if any)" value={outcomeForm.maternal_complications} onChange={(e) => setOutcomeForm({ ...outcomeForm, maternal_complications: e.target.value })} rows={2} />
        </div>
      </Modal>
    </div>
  );
}
