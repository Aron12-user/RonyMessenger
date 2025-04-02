
import React from 'react';
import { CalendarX } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="text-center py-10">
      <CalendarX className="h-12 w-12 mx-auto text-gray-400 mb-4" />
      <h3 className="text-lg font-semibold mb-2">Aucune réunion programmée</h3>
      <p className="text-gray-500 dark:text-gray-400">
        Vous n'avez pas encore de réunions programmées.
      </p>
    </div>
  );
}
