import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  User, ChevronRight, Baby, Heart, Syringe, FileText, Plus,
  Calendar, Clock, Pill, AlertTriangle, CheckCircle, CircleDot
} from 'lucide-react';
import {
  useMemberDetail, useMemberPregnancies, useMemberImmunizations,
  useMemberIllnesses, useRegisterPregnancy, useAdministerVaccine,
  useCreateIllness
} from '../hooks/useApi';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Drawer from '../components/common/Drawer';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import DatePicker from '../components/common/DatePicker';
import Textarea from '../components/common/Textarea';
import EmptyState from '../components/common/EmptyState';
import { calculateAge, formatDate, gestationalWeeks, pregnancyStatusDisplay, riskBadgeVariant } from '../utils/helpers';
import useAuthStore from '../stores/authStore';

export default function MemberDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);

  const { data: member, isLoading } = useMemberDetail(id);
  const { data: pregnancies } = useMemberPregnancies(id);
  const { data: immunizations } = useMemberImmunizations(id);
  const { data: illnesses } = useMemberIllnesses(id);

  const [activeTab, setActiveTab] = useState('health');
  const [showPregnancyModal, setShowPregnancyModal] = useState(false);
  const [showVaccineDrawer, setShowVaccineDrawer] = useState(false);
  const [showIllnessModal, setShowIllnessModal] = useState(false);
  const [selectedVaccine, setSelectedVaccine] = useState(null);

  const registerPregnancy = useRegisterPregnancy();
  const administerVaccine = useAdministerVaccine();
  const createIllness = useCreateIllness();

  // Pregnancy form
  const [pForm, setPForm] = useState({ lmp_date: '', edd: '', gravida: '', para: '' });
  // Illness form
  const [iForm, setIForm] = useState({ illness_name: '', icd10_code: '', onset_date: '', is_chronic: false, notes: '' });

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  if (!member) {
    return <EmptyState icon={User} title="Member not found" />;
  }

  const tabs = [
    { id: 'health', label: 'Health', icon: Heart },
    { id: 'immunizations', label: 'Immunizations', icon: Syringe },
    { id: 'illnesses', label: 'Illnesses', icon: FileText },
  ];

  const handleRegisterPregnancy = async () => {
    try {
      await registerPregnancy.mutateAsync({
        member_id: id,
        lmp_date: pForm.lmp_date || undefined,
        edd: pForm.edd || undefined,
        gravida: pForm.gravida ? parseInt(pForm.gravida) : undefined,
        para: pForm.para ? parseInt(pForm.para) : undefined,
      });
      setShowPregnancyModal(false);
      setPForm({ lmp_date: '', edd: '', gravida: '', para: '' });
    } catch (_) {}
  };

  const handleAdministerVaccine = async () => {
    if (!selectedVaccine) return;
    try {
      await administerVaccine.mutateAsync({
        immunization_record_id: selectedVaccine.id,
        administered_date: new Date().toISOString().split('T')[0],
      });
      setShowVaccineDrawer(false);
      setSelectedVaccine(null);
    } catch (_) {}
  };

  const handleCreateIllness = async () => {
    try {
      await createIllness.mutateAsync({
        member_id: id,
        ...iForm,
      });
      setShowIllnessModal(false);
      setIForm({ illness_name: '', icd10_code: '', onset_date: '', is_chronic: false, notes: '' });
    } catch (_) {}
  };

  // Vaccine status groups
  const givenVaccines = (immunizations || []).filter((v) => v.status === 'given');
  const dueVaccines = (immunizations || []).filter((v) => v.status === 'due');
  const overdueVaccines = (immunizations || []).filter((v) => v.status === 'overdue');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <button onClick={() => navigate('/households')} className="hover:text-primary transition-colors">Households</button>
        <ChevronRight className="w-3.5 h-3.5" />
        <button onClick={() => navigate(`/households/${member.household_id}`)} className="hover:text-primary transition-colors">
          {member.households?.malaria_number || 'Household'}
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-neutral-800 font-medium truncate">{member.full_name}</span>
      </div>

      {/* Member Header */}
      <div className="card overflow-hidden">
        <div className="gradient-header px-6 py-5 text-white">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${
              member.gender === 'male' ? 'bg-blue-400/30' :
              member.gender === 'female' ? 'bg-pink-400/30' : 'bg-white/20'
            }`}>
              {member.full_name?.charAt(0) || '?'}
            </div>
            <div>
              <h1 className="text-xl font-bold">{member.full_name}</h1>
              <p className="text-sm text-white/80">
                {member.gender?.charAt(0).toUpperCase() + member.gender?.slice(1) || '—'}
                {' · '}
                {calculateAge(member.date_of_birth, member.estimated_age)}
                {member.date_of_birth && ` (DOB: ${formatDate(member.date_of_birth)})`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 p-4">
          {member.is_head && <Badge variant="info">Head of Household</Badge>}
          {member.is_pregnant && <Badge variant="warning" dot>Pregnant</Badge>}
          {member.is_newborn && <Badge variant="success" dot>Newborn</Badge>}
          {member.has_chronic_illness && <Badge variant="danger" dot>Chronic Illness</Badge>}
          {member.phone && (
            <span className="text-xs text-neutral-500 flex items-center gap-1">
              📱 {member.phone}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all flex-1 justify-center ${
                activeTab === tab.id
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Health / Pregnancies Tab */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-800">Pregnancy History</h2>
            {member.gender === 'female' && !member.is_pregnant && (
              <Button size="sm" onClick={() => setShowPregnancyModal(true)}>
                <Plus className="w-3.5 h-3.5" /> Register Pregnancy
              </Button>
            )}
          </div>

          {!pregnancies || pregnancies.length === 0 ? (
            <EmptyState
              icon={Baby}
              title="No pregnancy records"
              description={member.gender === 'female' ? 'Register a pregnancy to begin tracking.' : 'Not applicable for this member.'}
            />
          ) : (
            <div className="space-y-3">
              {pregnancies.map((preg) => {
                const ga = gestationalWeeks(preg.lmp_date, preg.edd);
                return (
                  <div
                    key={preg.id}
                    onClick={() => navigate(`/pregnancies/${preg.id}`)}
                    className="card-hover p-4 cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                          <Baby className="w-5 h-5 text-pink-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-neutral-800">
                              {pregnancyStatusDisplay(preg.status)}
                            </span>
                            <Badge variant={riskBadgeVariant(preg.current_risk_level)} dot>
                              {preg.current_risk_level}
                            </Badge>
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {preg.lmp_date && `LMP: ${formatDate(preg.lmp_date)}`}
                            {preg.edd && ` · EDD: ${formatDate(preg.edd)}`}
                            {ga && ` · GA: ${ga.display}`}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0 mt-1" />
                    </div>
                    {preg.gravida && (
                      <p className="text-xs text-neutral-400 mt-2">
                        G{preg.gravida} P{preg.para || 0}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Immunizations Tab */}
      {activeTab === 'immunizations' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-neutral-800">Immunization Schedule</h2>

          {overdueVaccines.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-danger flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Overdue ({overdueVaccines.length})
              </h3>
              {overdueVaccines.map((v) => (
                <VaccineCard key={v.id} rec={v} status="overdue" onAdminister={() => { setSelectedVaccine(v); setShowVaccineDrawer(true); }} />
              ))}
            </div>
          )}

          {dueVaccines.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-warning flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Due ({dueVaccines.length})
              </h3>
              {dueVaccines.map((v) => (
                <VaccineCard key={v.id} rec={v} status="due" onAdminister={() => { setSelectedVaccine(v); setShowVaccineDrawer(true); }} />
              ))}
            </div>
          )}

          {givenVaccines.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-success flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Given ({givenVaccines.length})
              </h3>
              {givenVaccines.map((v) => (
                <VaccineCard key={v.id} rec={v} status="given" />
              ))}
            </div>
          )}

          {(!immunizations || immunizations.length === 0) && (
            <EmptyState icon={Syringe} title="No immunization records" description="Immunizations are auto-generated for newborns after delivery." />
          )}
        </div>
      )}

      {/* Illnesses Tab */}
      {activeTab === 'illnesses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-800">Illness History</h2>
            <Button size="sm" onClick={() => setShowIllnessModal(true)}>
              <Plus className="w-3.5 h-3.5" /> Log Illness
            </Button>
          </div>

          {!illnesses || illnesses.length === 0 ? (
            <EmptyState icon={FileText} title="No illness records" />
          ) : (
            <div className="space-y-3">
              {illnesses.map((ill) => (
                <div key={ill.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-800">{ill.illness_name}</span>
                        {ill.is_chronic && <Badge variant="danger" dot>Chronic</Badge>}
                        {ill.icd10_code && <Badge variant="neutral">{ill.icd10_code}</Badge>}
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        Onset: {formatDate(ill.onset_date)}
                        {ill.resolved_date && ` · Resolved: ${formatDate(ill.resolved_date)}`}
                      </p>
                    </div>
                  </div>

                  {ill.notes && (
                    <p className="text-xs text-neutral-500 mt-2">{ill.notes}</p>
                  )}

                  {ill.medications && ill.medications.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-neutral-100">
                      <p className="text-xs font-medium text-neutral-600 mb-1.5 flex items-center gap-1">
                        <Pill className="w-3.5 h-3.5" /> Medications
                      </p>
                      <div className="space-y-1">
                        {ill.medications.map((med) => (
                          <p key={med.id} className="text-xs text-neutral-500">
                            {med.drug_name} {med.dose && `— ${med.dose}`} {med.frequency && `(${med.frequency})`}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Register Pregnancy Modal */}
      <Modal
        isOpen={showPregnancyModal}
        onClose={() => setShowPregnancyModal(false)}
        title="Register Pregnancy"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPregnancyModal(false)}>Cancel</Button>
            <Button onClick={handleRegisterPregnancy} loading={registerPregnancy.isPending}>Register</Button>
          </>
        }
      >
        <div className="space-y-4">
          <DatePicker label="LMP Date" value={pForm.lmp_date} onChange={(e) => setPForm({ ...pForm, lmp_date: e.target.value })} />
          <DatePicker label="EDD (auto-calculated from LMP if empty)" value={pForm.edd} onChange={(e) => setPForm({ ...pForm, edd: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Gravida" type="number" value={pForm.gravida} onChange={(e) => setPForm({ ...pForm, gravida: e.target.value })} />
            <Input label="Para" type="number" value={pForm.para} onChange={(e) => setPForm({ ...pForm, para: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Administer Vaccine Drawer */}
      <Drawer
        isOpen={showVaccineDrawer}
        onClose={() => { setShowVaccineDrawer(false); setSelectedVaccine(null); }}
        title="Administer Vaccine"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowVaccineDrawer(false)}>Cancel</Button>
            <Button onClick={handleAdministerVaccine} loading={administerVaccine.isPending}>
              Mark as Given
            </Button>
          </>
        }
      >
        {selectedVaccine && (
          <div className="space-y-4">
            <div className="card p-4 bg-primary-light/50">
              <p className="text-sm font-semibold text-primary">{selectedVaccine.vaccines?.name || 'Vaccine'}</p>
              <p className="text-xs text-neutral-500 mt-1">
                {selectedVaccine.vaccines?.disease_covered}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Scheduled: {formatDate(selectedVaccine.scheduled_date)}
              </p>
            </div>
            <p className="text-sm text-neutral-600">
              This will record the vaccine as administered today ({new Date().toLocaleDateString()}).
            </p>
          </div>
        )}
      </Drawer>

      {/* Log Illness Modal */}
      <Modal
        isOpen={showIllnessModal}
        onClose={() => setShowIllnessModal(false)}
        title="Log Illness"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowIllnessModal(false)}>Cancel</Button>
            <Button onClick={handleCreateIllness} loading={createIllness.isPending}>Log</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Illness Name *"
            value={iForm.illness_name}
            onChange={(e) => setIForm({ ...iForm, illness_name: e.target.value })}
            placeholder="e.g., Acute Gastroenteritis"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="ICD-10 Code"
              value={iForm.icd10_code}
              onChange={(e) => setIForm({ ...iForm, icd10_code: e.target.value })}
              placeholder="e.g., A09"
            />
            <DatePicker
              label="Onset Date"
              value={iForm.onset_date}
              onChange={(e) => setIForm({ ...iForm, onset_date: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={iForm.is_chronic}
              onChange={(e) => setIForm({ ...iForm, is_chronic: e.target.checked })}
              className="rounded text-primary"
            />
            <span className="text-neutral-700">Chronic Illness</span>
          </label>
          <Textarea
            label="Notes"
            value={iForm.notes}
            onChange={(e) => setIForm({ ...iForm, notes: e.target.value })}
            rows={2}
          />
        </div>
      </Modal>
    </div>
  );
}

// Vaccine card sub-component
function VaccineCard({ rec, status, onAdminister }) {
  const statusColors = {
    overdue: 'border-l-danger',
    due: 'border-l-warning',
    given: 'border-l-success',
  };

  return (
    <div className={`card p-3 border-l-4 ${statusColors[status]} flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <CircleDot className={`w-4 h-4 ${
          status === 'given' ? 'text-success' : status === 'overdue' ? 'text-danger' : 'text-warning'
        }`} />
        <div>
          <p className="text-sm font-medium text-neutral-800">{rec.vaccines?.name || 'Vaccine'}</p>
          <p className="text-xs text-neutral-500">
            {rec.vaccines?.target_age_desc || ''}
            {rec.scheduled_date && ` · Scheduled: ${formatDate(rec.scheduled_date)}`}
            {rec.administered_date && ` · Given: ${formatDate(rec.administered_date)}`}
          </p>
        </div>
      </div>
      {onAdminister && status !== 'given' && (
        <Button size="sm" variant="success" onClick={onAdminister}>
          Give
        </Button>
      )}
    </div>
  );
}
