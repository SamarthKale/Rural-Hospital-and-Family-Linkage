import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Plus, Users, MapPin } from 'lucide-react';
import { useHouseholds, useVillages, useCreateHousehold } from '../hooks/useApi';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import SearchInput from '../components/common/SearchInput';
import Select from '../components/common/Select';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import Pagination from '../components/common/Pagination';
import useAuthStore from '../stores/authStore';

export default function HouseholdsPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const [search, setSearch] = useState('');
  const [villageId, setVillageId] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  // Form
  const [form, setForm] = useState({
    village_id: '', malaria_number: '', head_name: '',
    address_line: '', house_type: '', toilet_type: '',
    water_source: '', ration_card_type: '', lat: '', lng: '',
  });

  const { data: villages } = useVillages({});
  const { data: hhData, isLoading } = useHouseholds({ search, village_id: villageId || undefined, page, limit: 20 });
  const createMutation = useCreateHousehold();

  const households = hhData?.data || hhData || [];
  const pagination = hhData?.pagination;

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        ...form,
        lat: form.lat ? parseFloat(form.lat) : undefined,
        lng: form.lng ? parseFloat(form.lng) : undefined,
      });
      setShowCreate(false);
      setForm({ village_id: '', malaria_number: '', head_name: '', address_line: '', house_type: '', toilet_type: '', water_source: '', ration_card_type: '', lat: '', lng: '' });
    } catch (_) {}
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Households</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage household registrations</p>
        </div>
        {['admin', 'field_worker'].includes(role) && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Register Household
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search by malaria number or head name..."
            className="flex-1"
          />
          <Select
            options={(villages || []).map((v) => ({ value: v.id, label: v.name }))}
            placeholder="All Villages"
            value={villageId}
            onChange={(e) => { setVillageId(e.target.value); setPage(1); }}
            className="w-full sm:w-52"
          />
        </div>
      </div>

      {/* Household List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : households.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No households found"
          description="Register a new household or adjust your filters."
          actionLabel={['admin', 'field_worker'].includes(role) ? 'Register Household' : undefined}
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {households.map((hh) => (
              <div
                key={hh.id}
                onClick={() => navigate(`/households/${hh.id}`)}
                className="card-hover p-5 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
                      <Home className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-800">
                        {hh.malaria_number || 'N/A'}
                      </h3>
                      <p className="text-xs text-neutral-500">{hh.head_name || 'No head name'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {hh.members?.length || hh.member_count || 0} members
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {hh.villages?.name || '—'}
                  </span>
                </div>

                {hh.address_line && (
                  <p className="text-xs text-neutral-400 mt-2 truncate">{hh.address_line}</p>
                )}
              </div>
            ))}
          </div>

          {pagination && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Register New Household"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
            >
              Register
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Village *"
              options={(villages || []).map((v) => ({ value: v.id, label: v.name }))}
              value={form.village_id}
              onChange={(e) => setForm({ ...form, village_id: e.target.value })}
              placeholder="Select village"
            />
            <Input
              label="Malaria Number *"
              value={form.malaria_number}
              onChange={(e) => setForm({ ...form, malaria_number: e.target.value })}
              placeholder="e.g., MH-001"
            />
            <Input
              label="Head of Household"
              value={form.head_name}
              onChange={(e) => setForm({ ...form, head_name: e.target.value })}
              placeholder="Full name"
            />
            <Input
              label="Address"
              value={form.address_line}
              onChange={(e) => setForm({ ...form, address_line: e.target.value })}
              placeholder="House/Street"
            />
            <Select
              label="House Type"
              options={[
                { value: 'pucca', label: 'Pucca' },
                { value: 'semi_pucca', label: 'Semi-Pucca' },
                { value: 'kutcha', label: 'Kutcha' },
              ]}
              value={form.house_type}
              onChange={(e) => setForm({ ...form, house_type: e.target.value })}
            />
            <Select
              label="Water Source"
              options={[
                { value: 'tap', label: 'Tap' },
                { value: 'well', label: 'Well' },
                { value: 'borewell', label: 'Borewell' },
                { value: 'river', label: 'River' },
                { value: 'other', label: 'Other' },
              ]}
              value={form.water_source}
              onChange={(e) => setForm({ ...form, water_source: e.target.value })}
            />
            <Select
              label="Toilet Type"
              options={[
                { value: 'flush', label: 'Flush' },
                { value: 'pit', label: 'Pit' },
                { value: 'none', label: 'None' },
              ]}
              value={form.toilet_type}
              onChange={(e) => setForm({ ...form, toilet_type: e.target.value })}
            />
            <Select
              label="Ration Card"
              options={[
                { value: 'BPL', label: 'BPL' },
                { value: 'APL', label: 'APL' },
                { value: 'AAY', label: 'AAY' },
                { value: 'none', label: 'None' },
              ]}
              value={form.ration_card_type}
              onChange={(e) => setForm({ ...form, ration_card_type: e.target.value })}
            />
            <Input
              label="Latitude"
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
