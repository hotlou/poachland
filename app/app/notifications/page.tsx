'use client';

import { Bell, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Notification = {
  id: string;
  type: 'trade' | 'message' | 'offer' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'trade',
      title: 'New Trade Offer',
      message: 'alex_collector offered to trade their 2023 Nationals jersey for your rare disc',
      timestamp: '2 minutes ago',
      read: false,
    },
    {
      id: '2',
      type: 'message',
      title: 'Message from trader',
      message: 'jordan_trades: Hey! Is that Velocity still available?',
      timestamp: '15 minutes ago',
      read: false,
    },
    {
      id: '3',
      type: 'offer',
      title: 'Price Drop Alert',
      message: 'The Limited Edition Red Aviar you wanted is now 15% cheaper',
      timestamp: '1 hour ago',
      read: true,
    },
    {
      id: '4',
      type: 'system',
      title: 'Account Verified',
      message: 'Your account has been verified. You can now list premium items.',
      timestamp: '1 day ago',
      read: true,
    },
  ]);

  const typeColors = {
    trade: 'bg-accent/20 text-accent',
    message: 'bg-blue-500/20 text-blue-500',
    offer: 'bg-green-500/20 text-green-500',
    system: 'bg-purple-500/20 text-purple-500',
  };

  const typeLabels = {
    trade: 'Trade',
    message: 'Message',
    offer: 'Offer',
    system: 'System',
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <main className="pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <div className="bg-accent text-background text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
            {unreadCount}
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="p-8 text-center">
          <Bell className="w-12 h-12 text-secondary mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">All caught up!</h2>
          <p className="text-secondary-foreground">No new notifications</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {notifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => markAsRead(notif.id)}
              className={`p-4 cursor-pointer transition-colors ${
                notif.read ? 'bg-background' : 'bg-accent/5 hover:bg-accent/10'
              }`}
            >
              <div className="flex gap-4">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${notif.read ? 'bg-border' : 'bg-accent'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${typeColors[notif.type]}`}>
                        {typeLabels[notif.type]}
                      </span>
                      <h3 className="font-semibold text-foreground">{notif.title}</h3>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                      }}
                      className="text-secondary-foreground hover:text-foreground p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-secondary-foreground mt-1">{notif.message}</p>
                  <p className="text-xs text-secondary mt-2">{notif.timestamp}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
