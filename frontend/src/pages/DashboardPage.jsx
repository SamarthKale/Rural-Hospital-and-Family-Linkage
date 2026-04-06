import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, Users, Home, Bell, AlertTriangle, CalendarClock,
  Baby, Syringe, FileText, TrendingUp, ArrowRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
import { useAnalyticsSummary } from '../hooks/useApi';
import Spinner from '../components/common/Spinner';
import Badge from '../components/common/Badge';
import useAuthStore from '../stores/authStore';
import { riskBadgeVariant } from '../utils/helpers';

const COLORS = ['#1B6CA8', '#16A34A', '#D97706', '#DC2626', '#8B5CF6', '#EC4899'];

export default function DashboardPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const { data, isLoading } = useAnalyticsSummary({});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const monthlyPregnancies = data?.monthlyPregnancies || [];
  const outcomeBreakdown = data?.outcomeBreakdown || {};
  const riskDistribution = data?.riskDistribution || [];
  const topIllnesses = data?.topIllnesses || [];

  const outcomeData = Object.entries(outcomeBreakdown).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
  }));

  // KPI Cards
  const kpiCards = [
    { label: 'Active Pregnancies', value: kpis.activePregnancies || 0, icon: Baby, color: 'text-purple-600 bg-purple-50', path: null },
    { label: 'Critical Alerts', value: kpis.criticalAlerts || 0, icon: AlertTriangle, color: 'text-danger bg-danger-light', path: '/alerts' },
    { label: 'Overdue Vaccines', value: kpis.overdueVaccines || 0, icon: Syringe, color: 'text-warning bg-warning-light', path: null },
    { label: 'Total Households', value: kpis.totalHouseholds || 0, icon: Home, color: 'text-primary bg-primary-light', path: '/households' },
    { label: 'Deliveries (Month)', value: kpis.deliveriesThisMonth || 0, icon: Heart, color: 'text-success bg-success-light', path: null },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-800">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">Overview of your rural healthcare operations</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              onClick={() => kpi.path && navigate(kpi.path)}
              className={`card p-4 flex items-start gap-3 ${kpi.path ? 'cursor-pointer card-hover' : ''}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${kpi.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-800">{kpi.value}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{kpi.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Pregnancies Chart */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Pregnancy Registrations (12 Months)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyPregnancies}>
                <defs>
                  <linearGradient id="gradPreg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B6CA8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1B6CA8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#1B6CA8"
                  strokeWidth={2}
                  fill="url(#gradPreg)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pregnancy Outcomes Pie */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Pregnancy Outcomes
          </h3>
          <div className="h-64">
            {outcomeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#94A3B8' }}
                  >
                    {outcomeData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-neutral-400">
                No outcome data yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Pregnancy Risk Distribution
          </h3>
          {riskDistribution.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis type="category" dataKey="village_name" width={100} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
                  <Legend />
                  <Bar dataKey="low" stackId="a" fill="#16A34A" name="Low" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="medium" stackId="a" fill="#D97706" name="Medium" />
                  <Bar dataKey="high" stackId="a" fill="#DC2626" name="High" />
                  <Bar dataKey="critical" stackId="a" fill="#7F1D1D" name="Critical" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
              No active pregnancies
            </div>
          )}
        </div>

        {/* Top Illnesses */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Top Illnesses (6 Months)
          </h3>
          {topIllnesses.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topIllnesses}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} angle={-20} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
              No illness data
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'View Households', icon: Home, path: '/households' },
            { label: 'View Alerts', icon: Bell, path: '/alerts' },
            { label: 'Manage Villages', icon: Users, path: '/villages', roles: ['admin', 'supervisor'] },
            { label: 'Admin Panel', icon: CalendarClock, path: '/admin', roles: ['admin'] },
          ]
            .filter((a) => !a.roles || a.roles.includes(role))
            .map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-neutral-200 hover:border-primary/30 hover:bg-primary-light/30 transition-all group"
                >
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-neutral-700">{action.label}</span>
                  <ArrowRight className="w-4 h-4 ml-auto text-neutral-400 group-hover:text-primary transition-colors" />
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
