
import React from 'react';
import { Button } from "./ui/button";
import { CalendarX } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ 
  title = "Aucune réunion programmée",
  description = "Vous n'avez pas encore de réunions programmées.",
  action 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <CalendarX className="h-12 w-12 mx-auto text-gray-400 mb-4" />
      <h3 className="mt-2 text-lg font-medium">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}
