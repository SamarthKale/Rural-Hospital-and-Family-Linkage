import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import toast from 'react-hot-toast';

// ============================================================================
// AUTH
// ============================================================================
export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/api/auth/me').then((r) => r.data),
    retry: false,
  });
}

// ============================================================================
// VILLAGES / GEO
// ============================================================================
export function useStates() {
  return useQuery({
    queryKey: ['states'],
    queryFn: () => api.get('/api/villages/states').then((r) => r.data),
    staleTime: Infinity,
  });
}

export function useDistricts(stateId) {
  return useQuery({
    queryKey: ['districts', stateId],
    queryFn: () => api.get(`/api/villages/districts?state_id=${stateId}`).then((r) => r.data),
    enabled: !!stateId,
    staleTime: Infinity,
  });
}

export function useVillages(params) {
  const search = new URLSearchParams();
  if (params?.state_id) search.set('state_id', params.state_id);
  if (params?.district_id) search.set('district_id', params.district_id);
  if (params?.search) search.set('search', params.search);

  return useQuery({
    queryKey: ['villages', params],
    queryFn: () => api.get(`/api/villages?${search.toString()}`).then((r) => r.data),
  });
}

export function useVillageDetail(id) {
  return useQuery({
    queryKey: ['village', id],
    queryFn: () => api.get(`/api/villages/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

// ============================================================================
// HOUSEHOLDS
// ============================================================================
export function useHouseholds(params) {
  const search = new URLSearchParams();
  if (params?.village_id) search.set('village_id', params.village_id);
  if (params?.search) search.set('search', params.search);
  if (params?.page) search.set('page', params.page);
  if (params?.limit) search.set('limit', params.limit);

  return useQuery({
    queryKey: ['households', params],
    queryFn: () => api.get(`/api/households?${search.toString()}`).then((r) => r.data),
  });
}

export function useHouseholdDetail(id) {
  return useQuery({
    queryKey: ['household', id],
    queryFn: () => api.get(`/api/households/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/api/households', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['households'] });
      toast.success('Household created');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

export function useUpdateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/api/households/${id}`, data).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['households'] });
      qc.invalidateQueries({ queryKey: ['household', vars.id] });
      toast.success('Household updated');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

// ============================================================================
// MEMBERS
// ============================================================================
export function useMembers(householdId) {
  return useQuery({
    queryKey: ['members', householdId],
    queryFn: () => api.get(`/api/households/${householdId}/members`).then((r) => r.data),
    enabled: !!householdId,
  });
}

export function useMemberDetail(id) {
  return useQuery({
    queryKey: ['member', id],
    queryFn: () => api.get(`/api/members/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/api/members', data).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['members', vars.household_id] });
      toast.success('Member added');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/api/members/${id}`, data).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['member', vars.id] });
      qc.invalidateQueries({ queryKey: ['members'] });
      toast.success('Member updated');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

// ============================================================================
// RELATIONSHIPS
// ============================================================================
export function useRelationships(householdId) {
  return useQuery({
    queryKey: ['relationships', householdId],
    queryFn: () => api.get(`/api/households/${householdId}/relationships`).then((r) => r.data),
    enabled: !!householdId,
  });
}

export function useCreateRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/api/relationships', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['relationships'] });
      toast.success('Relationship added');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

// ============================================================================
// PREGNANCIES
// ============================================================================
export function useMemberPregnancies(memberId) {
  return useQuery({
    queryKey: ['pregnancies', 'member', memberId],
    queryFn: () => api.get(`/api/members/${memberId}/pregnancies`).then((r) => r.data),
    enabled: !!memberId,
  });
}

export function usePregnancyDetail(id) {
  return useQuery({
    queryKey: ['pregnancy', id],
    queryFn: () => api.get(`/api/pregnancies/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useRegisterPregnancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/api/pregnancies', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pregnancies'] });
      qc.invalidateQueries({ queryKey: ['member'] });
      toast.success('Pregnancy registered');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

export function useUpdatePregnancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/api/pregnancies/${id}`, data).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pregnancy', vars.id] });
      toast.success('Pregnancy updated');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

export function useLogAncVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pregnancyId, ...data }) =>
      api.post(`/api/pregnancies/${pregnancyId}/anc-visits`, data).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pregnancy', vars.pregnancyId] });
      toast.success('ANC visit recorded');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

export function useRecordOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pregnancyId, ...data }) =>
      api.post(`/api/pregnancies/${pregnancyId}/outcome`, data).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pregnancy', vars.pregnancyId] });
      qc.invalidateQueries({ queryKey: ['pregnancies'] });
      qc.invalidateQueries({ queryKey: ['member'] });
      toast.success('Outcome recorded');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

// ============================================================================
// IMMUNIZATIONS
// ============================================================================
export function useMemberImmunizations(memberId) {
  return useQuery({
    queryKey: ['immunizations', memberId],
    queryFn: () => api.get(`/api/members/${memberId}/immunizations`).then((r) => r.data),
    enabled: !!memberId,
  });
}

export function useAdministerVaccine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/api/immunizations', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['immunizations'] });
      qc.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Vaccine administered');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

// ============================================================================
// ILLNESS LOGS
// ============================================================================
export function useMemberIllnesses(memberId) {
  return useQuery({
    queryKey: ['illnesses', memberId],
    queryFn: () => api.get(`/api/members/${memberId}/illness-logs`).then((r) => r.data),
    enabled: !!memberId,
  });
}

export function useCreateIllness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/api/illness-logs', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['illnesses'] });
      qc.invalidateQueries({ queryKey: ['member'] });
      toast.success('Illness logged');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

export function useUpdateIllness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/api/illness-logs/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['illnesses'] });
      toast.success('Illness updated');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

// ============================================================================
// DISEASES
// ============================================================================
export function useDiseaseSearch(query) {
  return useQuery({
    queryKey: ['diseases', query],
    queryFn: () => api.get(`/api/diseases/search?q=${encodeURIComponent(query)}`).then((r) => r.data),
    enabled: query?.length >= 2,
    staleTime: 60 * 60 * 1000, // 1hr
  });
}

// ============================================================================
// ALERTS
// ============================================================================
export function useAlerts(params) {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.severity) search.set('severity', params.severity);
  if (params?.alert_type) search.set('alert_type', params.alert_type);
  if (params?.village_id) search.set('village_id', params.village_id);
  if (params?.page) search.set('page', params.page);
  if (params?.limit) search.set('limit', params.limit);

  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () => api.get(`/api/alerts?${search.toString()}`).then((r) => r.data),
    refetchInterval: 60000, // every minute
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/api/alerts/${id}/acknowledge`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Alert acknowledged');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

// ============================================================================
// ADMIN
// ============================================================================
export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get('/api/admin/users').then((r) => r.data),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/api/admin/users', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User created');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/api/admin/users/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User updated');
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });
}

export function useAuditLogs(params) {
  const search = new URLSearchParams();
  if (params?.user_id) search.set('user_id', params.user_id);
  if (params?.table_name) search.set('table_name', params.table_name);
  if (params?.start_date) search.set('start_date', params.start_date);
  if (params?.end_date) search.set('end_date', params.end_date);
  if (params?.page) search.set('page', params.page);
  if (params?.limit) search.set('limit', params.limit);

  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => api.get(`/api/admin/audit-logs?${search.toString()}`).then((r) => r.data),
  });
}

export function useAnalyticsSummary(params) {
  const search = new URLSearchParams();
  if (params?.village_id) search.set('village_id', params.village_id);

  return useQuery({
    queryKey: ['analytics', 'summary', params],
    queryFn: () => api.get(`/api/admin/analytics/summary?${search.toString()}`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useVillageAnalytics(villageId) {
  return useQuery({
    queryKey: ['analytics', 'village', villageId],
    queryFn: () => api.get(`/api/admin/analytics/villages/${villageId}`).then((r) => r.data),
    enabled: !!villageId,
  });
}
