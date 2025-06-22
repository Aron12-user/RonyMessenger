import { ReactNode } from "react";

interface MainContentProps {
  children: ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  return (
    <div 
      className="flex-1 flex flex-col overflow-hidden rounded-tl-3xl transition-all duration-500 ease-out"
      style={{
        background: 'rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(20px)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className="animate-in fade-in-0 duration-500 h-full">
        {children}
      </div>
    </div>
  );
}