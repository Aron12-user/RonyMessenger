import { ReactNode } from "react";

interface MainContentProps {
  children: ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  return (
    <div 
      className="flex-1 flex flex-col overflow-hidden rounded-tl-3xl"
      style={{
        background: 'var(--color-surface)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {children}
    </div>
  );
}