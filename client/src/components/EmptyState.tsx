
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
import { Button } from "./ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
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
