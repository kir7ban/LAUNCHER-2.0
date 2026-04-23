import React from 'react';
import { useAgentContext } from '../context/AgentContext';
import '../styles/NotificationsDropdown.css';

export default function NotificationsDropdown({ onClose }) {
  const { notifications, setNotifications } = useAgentContext();
  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="notif-dropdown">
      <div className="notif-header">
        <span className="notif-title">Notifications</span>
        {unreadCount > 0 && (
          <button className="notif-mark-all" onClick={markAllRead}>Mark all read</button>
        )}
      </div>
      <div className="notif-list">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`notif-item ${n.read ? 'read' : 'unread'}`}
            onClick={() => markRead(n.id)}
          >
            <div className={`notif-dot ${n.read ? '' : 'unread'}`} />
            <div className="notif-content">
              <span className="notif-text">{n.text}</span>
              <span className="notif-time">{n.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
