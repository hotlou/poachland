'use client';

import { BarChart3, Users, Package, AlertCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminDashboard() {
  const stats = [
    { label: 'Total Users', value: '2,847', trend: '+12%', icon: Users },
    { label: 'Active Listings', value: '1,204', trend: '+5%', icon: Package },
    { label: 'Completed Trades', value: '4,892', trend: '+28%', icon: TrendingUp },
    { label: 'Flagged Items', value: '23', trend: '-8%', icon: AlertCircle },
  ];

  const recentActivity = [
    { user: 'alex_collector', action: 'Listed rare 2019 Nationals jersey', time: '5 min ago' },
    { user: 'jordan_trades', action: 'Completed trade with validator', time: '12 min ago' },
    { user: 'disc_hunter', action: 'Posted ISO request for Glow Buzzz', time: '28 min ago' },
    { user: 'jersey_king', action: 'Account flagged for review', time: '1 hour ago' },
  ];

  const flaggedListings = [
    { id: '1', title: 'Rare 1999 Nationals Jersey', seller: 'unknown_trader', reason: 'Unverified seller' },
    { id: '2', title: 'Holographic Disc Set', seller: 'sketchy_dealer', reason: 'Suspicious pricing' },
    { id: '3', title: 'Championship Medal', seller: 'collector_99', reason: 'Counterfeit report' },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-8 h-8 text-accent" />
            <h1 className="text-4xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <p className="text-secondary-foreground">Monitor marketplace activity and manage content</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            const isPositive = stat.trend.startsWith('+');
            return (
              <div key={i} className="bg-secondary border border-border rounded-lg p-6">
                <div className="flex items-start justify-between mb-3">
                  <Icon className="w-6 h-6 text-accent" />
                  <span className={`text-xs font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {stat.trend}
                  </span>
                </div>
                <p className="text-secondary-foreground text-sm mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-secondary border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-start gap-3 pb-4 border-b border-border last:border-b-0">
                  <div className="w-2 h-2 rounded-full bg-accent mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{item.user}</p>
                    <p className="text-sm text-secondary-foreground">{item.action}</p>
                    <p className="text-xs text-secondary mt-1">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-secondary border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Button className="w-full bg-accent text-background hover:bg-accent/90">
                Review Flagged Items
              </Button>
              <Button variant="outline" className="w-full">
                View User Reports
              </Button>
              <Button variant="outline" className="w-full">
                Send Announcement
              </Button>
              <Button variant="outline" className="w-full">
                Manage Moderators
              </Button>
            </div>
          </div>
        </div>

        {/* Flagged Listings */}
        <div className="mt-8 bg-secondary border border-border rounded-lg p-6">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Flagged for Review
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-sm font-semibold text-secondary-foreground">Item</th>
                  <th className="text-left p-3 text-sm font-semibold text-secondary-foreground">Seller</th>
                  <th className="text-left p-3 text-sm font-semibold text-secondary-foreground">Reason</th>
                  <th className="text-left p-3 text-sm font-semibold text-secondary-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {flaggedListings.map(listing => (
                  <tr key={listing.id} className="border-b border-border hover:bg-background/50 transition-colors">
                    <td className="p-3 text-foreground">{listing.title}</td>
                    <td className="p-3 text-secondary-foreground">{listing.seller}</td>
                    <td className="p-3">
                      <span className="bg-red-500/20 text-red-500 text-xs font-bold px-2 py-1 rounded">
                        {listing.reason}
                      </span>
                    </td>
                    <td className="p-3">
                      <button className="text-accent hover:text-accent/80 font-semibold text-sm">
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
