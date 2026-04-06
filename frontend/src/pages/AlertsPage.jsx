import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, User } from 'lucide-react';
import { useAlerts, useAcknowledgeAlert } from '../hooks/useApi';
import Spinner from '../components/common/Spinner';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import Pagination from '../components/common/Pagination';
import EmptyState from '../components/common/EmptyState';
import { formatDate } from '../utils/helpers';

export default function AlertsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('active');
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAlerts({ status, severity: severity || undefined, page, limit: 20 });
  const acknowledge = useAcknowledgeAlert();

  const alerts = data?.data || [];
  const pagination = data?.pagination;

  const severityConfig = {
    critical: { color: 'danger', icon: '🔴', border: 'border-l-danger' },
    high: { color: 'warning', icon: '🟠', border: 'border-l-warning' },
    medium: { color: 'info', icon: '🔵', border: 'border-l-primary' },
    low: { color: 'neutral', icon: '⚪', border: 'border-l-neutral-300' },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-neutral-800">Alerts</h1>
        <p className="text-sm text-neutral-500 mt-1">Clinical follow-up alerts</p>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          {['active', 'acknowledged', 'resolved'].map((s) => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${status === s ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
              {s}
            </button>
          ))}
        </div>
        <Select options={[
          { value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' },
          { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
        ]} placeholder="All Severities" value={severity}
          onChange={(e) => { setSeverity(e.target.value); setPage(1); }} className="w-full sm:w-48" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : alerts.length === 0 ? (
        <EmptyState icon={Bell} title="No alerts" description={`No ${status} alerts.`} />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const sc = severityConfig[alert.severity] || severityConfig.low;
            return (
              <div key={alert.id} className={`card p-4 border-l-4 ${sc.border}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 text-lg">{sc.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-neutral-800">{alert.title}</h3>
                        <Badge variant={sc.color}>{alert.severity}</Badge>
                        <Badge variant="neutral">{alert.alert_type?.replace(/_/g, ' ')}</Badge>
                      </div>
                      {alert.description && <p className="text-xs text-neutral-500 mt-1">{alert.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-neutral-400">
                        <span>{formatDate(alert.created_at)}</span>
                        {alert.members?.full_name && (
                          <button onClick={() => navigate(`/members/${alert.member_id}`)}
                            className="flex items-center gap-1 text-primary hover:underline">
                            <User className="w-3 h-3" /> {alert.members.full_name}
                          </button>
                        )}
                        {alert.villages?.name && <span>{alert.villages.name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {alert.status === 'active' && (
                      <Button size="sm" variant="secondary" onClick={() => acknowledge.mutate(alert.id)} loading={acknowledge.isPending}>
                        <CheckCircle className="w-3.5 h-3.5" /> Ack
                      </Button>
                    )}
                    {alert.status === 'acknowledged' && <span className="text-xs text-neutral-400">Ack'd {formatDate(alert.acknowledged_at)}</span>}
                    {alert.status === 'resolved' && <Badge variant="success">Resolved</Badge>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />}
    </div>
  );
}
