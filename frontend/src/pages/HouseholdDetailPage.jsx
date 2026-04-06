import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Home, User, Plus, MapPin, Droplets, Phone,
  ChevronRight, Edit2, Baby, Heart, Stethoscope
} from 'lucide-react';
import {
  useHouseholdDetail, useMembers, useRelationships,
  useCreateMember, useCreateRelationship
} from '../hooks/useApi';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import DatePicker from '../components/common/DatePicker';
import EmptyState from '../components/common/EmptyState';
import { calculateAge, formatDate } from '../utils/helpers';

export default function HouseholdDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddRel, setShowAddRel] = useState(false);

  const { data: household, isLoading: hhLoading } = useHouseholdDetail(id);
  const { data: members, isLoading: memLoading } = useMembers(id);
  const { data: relationships } = useRelationships(id);

  const createMember = useCreateMember();
  const createRelationship = useCreateRelationship();

  // Member form
  const [mForm, setMForm] = useState({
    full_name: '', gender: '', date_of_birth: '', estimated_age: '',
    phone: '', aadhar_encrypted: '', is_head: false,
  });

  // Relationship form
  const [rForm, setRForm] = useState({
    member_id: '', related_member_id: '', relationship_type: '',
  });

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await createMember.mutateAsync({
        ...mForm,
        household_id: id,
        estimated_age: mForm.estimated_age ? parseInt(mForm.estimated_age) : undefined,
      });
      setShowAddMember(false);
      setMForm({ full_name: '', gender: '', date_of_birth: '', estimated_age: '', phone: '', aadhar_encrypted: '', is_head: false });
    } catch (_) {}
  };

  const handleAddRelationship = async (e) => {
    e.preventDefault();
    try {
      await createRelationship.mutateAsync({ ...rForm, household_id: id });
      setShowAddRel(false);
      setRForm({ member_id: '', related_member_id: '', relationship_type: '' });
    } catch (_) {}
  };

  if (hhLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  if (!household) {
    return <EmptyState icon={Home} title="Household not found" />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <button onClick={() => navigate('/households')} className="hover:text-primary transition-colors">
          Households
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-neutral-800 font-medium">{household.malaria_number || 'Detail'}</span>
      </div>

      {/* Header Card */}
      <div className="card overflow-hidden">
        <div className="gradient-header p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                <Home className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{household.malaria_number || 'N/A'}</h1>
                <p className="text-sm text-white/80">{household.head_name || 'No head name'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-neutral-400" />
            <span className="text-neutral-600">{household.villages?.name || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Home className="w-4 h-4 text-neutral-400" />
            <span className="text-neutral-600 capitalize">{household.house_type?.replace(/_/g, ' ') || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Droplets className="w-4 h-4 text-neutral-400" />
            <span className="text-neutral-600 capitalize">{household.water_source || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-neutral-400 text-xs font-medium">Ration:</span>
            <span className="text-neutral-600">{household.ration_card_type || '—'}</span>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-800 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Members ({members?.length || 0})
          </h2>
          <Button size="sm" onClick={() => setShowAddMember(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Member
          </Button>
        </div>

        {memLoading ? (
          <div className="p-8 flex justify-center"><Spinner /></div>
        ) : !members || members.length === 0 ? (
          <EmptyState
            icon={User}
            title="No members"
            description="Add the first member to this household."
            actionLabel="Add Member"
            onAction={() => setShowAddMember(true)}
          />
        ) : (
          <div className="divide-y divide-neutral-100">
            {members.map((member) => (
              <div
                key={member.id}
                onClick={() => navigate(`/members/${member.id}`)}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50 cursor-pointer transition-colors group"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                  member.gender === 'male' ? 'bg-blue-50 text-blue-600' :
                  member.gender === 'female' ? 'bg-pink-50 text-pink-600' :
                  'bg-neutral-100 text-neutral-500'
                }`}>
                  {member.full_name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-800 truncate">{member.full_name}</p>
                    {member.is_head && <Badge variant="info">Head</Badge>}
                    {member.is_pregnant && <Badge variant="warning" dot>Pregnant</Badge>}
                    {member.is_newborn && <Badge variant="success" dot>Newborn</Badge>}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {member.gender ? member.gender.charAt(0).toUpperCase() + member.gender.slice(1) : '—'}
                    {' · '}
                    {calculateAge(member.date_of_birth, member.estimated_age)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {member.is_pregnant && <Heart className="w-4 h-4 text-pink-500" />}
                  {member.has_chronic_illness && <Stethoscope className="w-4 h-4 text-warning" />}
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Relationships */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-800">Family Relationships</h2>
          {members && members.length >= 2 && (
            <Button size="sm" variant="secondary" onClick={() => setShowAddRel(true)}>
              <Plus className="w-3.5 h-3.5" /> Add Relation
            </Button>
          )}
        </div>

        {relationships && relationships.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {relationships.map((rel) => (
              <div key={rel.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="font-medium text-neutral-700">{rel.member?.full_name || 'Unknown'}</span>
                <Badge variant="neutral">{rel.relationship_type?.replace(/_/g, ' ')}</Badge>
                <span className="text-neutral-400">of</span>
                <span className="font-medium text-neutral-700">{rel.related_member?.full_name || 'Unknown'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-sm text-neutral-400 text-center">
            No relationships defined yet.
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        title="Add Member"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddMember(false)}>Cancel</Button>
            <Button onClick={handleAddMember} loading={createMember.isPending}>Add Member</Button>
          </>
        }
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name *"
              value={mForm.full_name}
              onChange={(e) => setMForm({ ...mForm, full_name: e.target.value })}
              placeholder="Enter full name"
            />
            <Select
              label="Gender *"
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
              value={mForm.gender}
              onChange={(e) => setMForm({ ...mForm, gender: e.target.value })}
            />
            <DatePicker
              label="Date of Birth"
              value={mForm.date_of_birth}
              onChange={(e) => setMForm({ ...mForm, date_of_birth: e.target.value })}
            />
            <Input
              label="Estimated Age (if DOB unknown)"
              type="number"
              value={mForm.estimated_age}
              onChange={(e) => setMForm({ ...mForm, estimated_age: e.target.value })}
            />
            <Input
              label="Phone"
              value={mForm.phone}
              onChange={(e) => setMForm({ ...mForm, phone: e.target.value })}
              placeholder="+91 XXXXX XXXXX"
            />
            <Input
              label="Aadhaar (encrypted)"
              value={mForm.aadhar_encrypted}
              onChange={(e) => setMForm({ ...mForm, aadhar_encrypted: e.target.value })}
              placeholder="Will be stored encrypted"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mForm.is_head}
              onChange={(e) => setMForm({ ...mForm, is_head: e.target.checked })}
              className="rounded text-primary focus:ring-primary"
            />
            <span className="text-neutral-700">Head of Household</span>
          </label>
        </form>
      </Modal>

      {/* Add Relationship Modal */}
      <Modal
        isOpen={showAddRel}
        onClose={() => setShowAddRel(false)}
        title="Add Relationship"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddRel(false)}>Cancel</Button>
            <Button onClick={handleAddRelationship} loading={createRelationship.isPending}>Add</Button>
          </>
        }
      >
        <form onSubmit={handleAddRelationship} className="space-y-4">
          <Select
            label="Member"
            options={(members || []).map((m) => ({ value: m.id, label: m.full_name }))}
            value={rForm.member_id}
            onChange={(e) => setRForm({ ...rForm, member_id: e.target.value })}
          />
          <Select
            label="Relationship Type"
            options={[
              { value: 'parent', label: 'Parent' },
              { value: 'child', label: 'Child' },
              { value: 'spouse', label: 'Spouse' },
              { value: 'sibling', label: 'Sibling' },
              { value: 'grandparent', label: 'Grandparent' },
              { value: 'grandchild', label: 'Grandchild' },
              { value: 'other', label: 'Other' },
            ]}
            value={rForm.relationship_type}
            onChange={(e) => setRForm({ ...rForm, relationship_type: e.target.value })}
          />
          <Select
            label="Related To"
            options={(members || []).filter((m) => m.id !== rForm.member_id).map((m) => ({ value: m.id, label: m.full_name }))}
            value={rForm.related_member_id}
            onChange={(e) => setRForm({ ...rForm, related_member_id: e.target.value })}
          />
        </form>
      </Modal>
    </div>
  );
}
