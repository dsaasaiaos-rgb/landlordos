import { cn } from '@/lib/utils';

const variants = {
  // Occupancy
  Occupied: 'bg-green-100 text-green-700 border-green-200',
  Vacant: 'bg-red-100 text-red-700 border-red-200',
  Renovation: 'bg-orange-100 text-orange-700 border-orange-200',
  Listed: 'bg-blue-100 text-blue-700 border-blue-200',
  Offline: 'bg-gray-100 text-gray-700 border-gray-200',
  // Payment
  Current: 'bg-green-100 text-green-700 border-green-200',
  'Collections': 'bg-red-100 text-red-700 border-red-200',
  // Risk
  Low: 'bg-green-100 text-green-700 border-green-200',
  Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Critical: 'bg-red-100 text-red-700 border-red-200',
  // Status
  Active: 'bg-green-100 text-green-700 border-green-200',
  Sold: 'bg-gray-100 text-gray-700 border-gray-200',
  'Under Contract': 'bg-blue-100 text-blue-700 border-blue-200',
  // Maintenance
  Open: 'bg-blue-100 text-blue-700 border-blue-200',
  Assigned: 'bg-purple-100 text-purple-700 border-purple-200',
  In_Progress: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Completed: 'bg-green-100 text-green-700 border-green-200',
  Cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
  Pending_Parts: 'bg-orange-100 text-orange-700 border-orange-200',
  // Priority
  Emergency: 'bg-red-100 text-red-700 border-red-200',
  // Reconciliation
  Reconciled: 'bg-green-100 text-green-700 border-green-200',
  Unreconciled: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Pending: 'bg-blue-100 text-blue-700 border-blue-200',
  Disputed: 'bg-red-100 text-red-700 border-red-200',
  // Default
  default: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function StatusBadge({ status, className }) {
  const variant = variants[status] || variants.default;
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
      variant, className
    )}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}