import React, { useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { useVillages, useStates, useDistricts } from '../hooks/useApi';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import SearchInput from '../components/common/SearchInput';
import Select from '../components/common/Select';

export default function VillagesPage() {
  const [search, setSearch] = useState('');
  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');

  const { data: states } = useStates();
  const { data: districts } = useDistricts(stateId);
  const { data: villages, isLoading } = useVillages({
    search,
    state_id: stateId || undefined,
    district_id: districtId || undefined,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-neutral-800">Villages</h1>
        <p className="text-sm text-neutral-500 mt-1">Geographic units under your jurisdiction</p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search villages..."
            className="flex-1"
          />
          <Select
            options={(states || []).map((s) => ({ value: s.id, label: s.name }))}
            placeholder="All States"
            value={stateId}
            onChange={(e) => {
              setStateId(e.target.value);
              setDistrictId('');
            }}
            className="w-full sm:w-48"
          />
          <Select
            options={(districts || []).map((d) => ({ value: d.id, label: d.name }))}
            placeholder="All Districts"
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>
      </div>

      {/* Village Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : !villages || villages.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No villages found"
          description="Adjust your filters or add villages through the admin panel."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {villages.map((village) => (
            <div
              key={village.id}
              className="card-hover p-5 flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-neutral-800 truncate">{village.name}</h3>
                  <p className="text-xs text-neutral-500">
                    {village.sub_districts?.name || ''}{village.sub_districts?.name ? ', ' : ''}
                    {village.districts?.name || ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-neutral-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-neutral-800">{village.households?.[0]?.count || 0}</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Households</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-neutral-800">{village.population || '—'}</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Population</p>
                </div>
                <div className="bg-neutral-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-neutral-800">{village.phc_name ? '✓' : '—'}</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wide">PHC</p>
                </div>
              </div>

              {village.phc_name && (
                <p className="text-xs text-neutral-500">
                  <span className="font-medium">PHC:</span> {village.phc_name}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
