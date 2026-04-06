import React, { useState } from 'react';
import { Settings, Users, FileText, Plus, Shield, MapPin, Search } from 'lucide-react';
import { useAdminUsers, useCreateUser, useUpdateUser, useAuditLogs, useVillages } from '../hooks/useApi';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import Pagination from '../components/common/Pagination';
import EmptyState from '../components/common/EmptyState';
import SearchInput from '../components/common/SearchInput';
import { formatDate } from '../utils/helpers';

export default function AdminPage() {
  const [tab, setTab] = useState('users');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-neutral-800">Admin Panel</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage users and view audit logs</p>
      </div>

      <div className="flex gap-2">
        {[{ id: 'users', label: 'Users', icon: Users }, { id: 'audit', label: 'Audit Logs', icon: FileText }].map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-primary text-white shadow-sm' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

function UsersTab() {
  const { data: users, isLoading } = useAdminUsers();
  const { data: villages } = useVillages({});
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', phone: '', role: '', village_ids: [],
  });

  const filtered = (users || []).filter((u) =>
    !search || u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    try {
      await createUser.mutateAsync(form);
      setShowCreate(false);
      setForm({ full_name: '', email: '', password: '', phone: '', role: '', village_ids: [] });
    } catch (_) {}
  };

  const roleColors = {
    admin: 'danger', doctor: 'info',
    field_worker: 'success', supervisor: 'warning',
  };

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search users..." className="flex-1 max-w-sm" />
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Create User</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No users found" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Villages</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">{user.fullName}</td>
                    <td className="px-4 py-3 text-neutral-500">{user.email || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={roleColors[user.role] || 'neutral'}>{user.role?.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">
                      {user.assignedVillages?.map((v) => v.name).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.isActive !== false ? 'success' : 'danger'}>
                        {user.isActive !== false ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.isActive !== false ? (
                        <Button size="sm" variant="ghost" onClick={() => updateUser.mutate({ id: user.id, is_active: false })}>
                          Disable
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => updateUser.mutate({ id: user.id, is_active: true })}>
                          Enable
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create User" size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button onClick={handleCreate} loading={createUser.isPending}>Create</Button>
        </>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Full Name *" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input label="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Password *" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Select label="Role *" options={[
              { value: 'admin', label: 'Admin' }, { value: 'doctor', label: 'Doctor' },
              { value: 'field_worker', label: 'Field Worker' }, { value: 'supervisor', label: 'Supervisor' },
            ]} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-700 mb-2">Assign Villages</p>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {(villages || []).map((v) => (
                <label key={v.id} className="flex items-center gap-1.5 text-xs bg-neutral-50 px-2 py-1 rounded-lg cursor-pointer hover:bg-neutral-100">
                  <input type="checkbox" checked={form.village_ids.includes(v.id)}
                    onChange={(e) => {
                      setForm({ ...form, village_ids: e.target.checked
                        ? [...form.village_ids, v.id]
                        : form.village_ids.filter((id) => id !== v.id)
                      });
                    }} className="rounded text-primary" />
                  {v.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AuditTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLogs({ page, limit: 30 });
  const logs = data?.data || [];
  const pagination = data?.pagination;

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      {logs.length === 0 ? (
        <EmptyState icon={FileText} title="No audit logs" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Table</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-600">Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3 text-neutral-700">{log.platform_users?.full_name || log.user_id?.slice(0, 8)}</td>
                    <td className="px-4 py-3"><Badge variant="neutral">{log.action}</Badge></td>
                    <td className="px-4 py-3 text-neutral-500">{log.table_name}</td>
                    <td className="px-4 py-3 text-xs text-neutral-400 font-mono">{log.record_id?.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />}
    </div>
  );
}
