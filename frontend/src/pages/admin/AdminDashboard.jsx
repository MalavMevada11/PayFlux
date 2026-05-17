import { useState, useEffect } from 'react';
import { api } from '../../api';
import { Card } from '../../components/ui/card';
import { Building2, Users, FileText, CreditCard, TrendingUp, Link2, AlertTriangle, DollarSign } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/admin/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  const cards = [
    { label: 'Total Businesses', value: stats?.total_businesses || 0, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: 'Total Customers', value: stats?.total_customers || 0, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Total Users', value: stats?.total_users || 0, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
    { label: 'Total Invoices', value: stats?.total_invoices || 0, icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    { label: 'Total Revenue', value: `₹${Number(stats?.total_revenue || 0).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    { label: 'Payments Collected', value: `₹${Number(stats?.total_payments_collected || 0).toLocaleString('en-IN')}`, icon: DollarSign, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
    { label: 'Paid Invoices', value: stats?.paid_invoices || 0, icon: CreditCard, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
    { label: 'Overdue Invoices', value: stats?.overdue_invoices || 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    { label: 'Active Links', value: stats?.total_links || 0, icon: Link2, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform-wide overview and statistics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.label} className={`p-5 border ${card.border} ${card.bg}/30 hover:shadow-md transition-all duration-200`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">{card.label}</p>
                <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
