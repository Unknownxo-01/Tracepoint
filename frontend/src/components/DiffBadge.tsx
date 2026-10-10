import React from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, XCircle, HelpCircle } from 'lucide-react';

interface DiffBadgeProps {
  type: 'MATCH' | 'FIRST_DIVERGENCE' | 'DOWNSTREAM_DIFFERENCE' | 'UNMATCHED_A' | 'UNMATCHED_B' | string;
  size?: 'sm' | 'md' | 'lg';
}

export const DiffBadge: React.FC<DiffBadgeProps> = ({ type, size = 'md' }) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  switch (type) {
    case 'MATCH':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${
          isSm ? 'px-2 py-0.5 text-xs' : isLg ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
        }`}>
          <CheckCircle2 className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          Match
        </span>
      );

    case 'FIRST_DIVERGENCE':
      return (
        <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-300 shadow-sm animate-pulse ${
          isSm ? 'px-2.5 py-0.5 text-xs' : isLg ? 'px-4 py-1.5 text-sm' : 'px-3 py-1 text-xs'
        }`}>
          <AlertTriangle className={isSm ? 'w-3 h-3 text-rose-600' : 'w-4 h-4 text-rose-600'} />
          First Observed Divergence
        </span>
      );

    case 'DOWNSTREAM_DIFFERENCE':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200 ${
          isSm ? 'px-2 py-0.5 text-xs' : isLg ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
        }`}>
          <ChevronRight className={isSm ? 'w-3 h-3 text-amber-600' : 'w-3.5 h-3.5 text-amber-600'} />
          Downstream Difference
        </span>
      );

    case 'UNMATCHED_A':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-300 ${
          isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
        }`}>
          <XCircle className="w-3.5 h-3.5 text-slate-500" />
          Trace A Only
        </span>
      );

    case 'UNMATCHED_B':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200 ${
          isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
        }`}>
          <HelpCircle className="w-3.5 h-3.5 text-purple-500" />
          Trace B Only (Extra)
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
          {type}
        </span>
      );
  }
};
