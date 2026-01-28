
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  // Added id to CardProps to allow identifying the component, fixing errors where id is passed to Card
  id?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, id }) => (
  <div id={id} className={`bg-white rounded-2xl shadow-md border-2 border-slate-200 dark:bg-slate-900 dark:border-slate-700/50 overflow-hidden ${className}`}>
    {title && (
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-gradient-to-r from-slate-50 to-slate-50/50 dark:from-slate-800/30 dark:to-slate-900/30">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>
    )}
    <div className="p-6">
      {children}
    </div>
  </div>
);