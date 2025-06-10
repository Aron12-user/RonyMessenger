import { MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeContentProps {
  onNewConversation: () => void;
}

export default function WelcomeContent({ onNewConversation }: WelcomeContentProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div 
            className="w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6"
            style={{ background: 'var(--color-surface)' }}
          >
            <MessageCircle className="w-12 h-12" style={{ color: 'var(--color-primary)' }} />
          </div>
          
          <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
            Bienvenue sur Rony
          </h2>
          
          <p className="text-lg mb-8" style={{ color: 'var(--color-textMuted)' }}>
            Sélectionnez une conversation pour commencer à discuter
          </p>
        </div>

        <Button
          onClick={onNewConversation}
          className="px-6 py-3 text-white font-medium rounded-xl"
          style={{ background: 'var(--color-primary)' }}
        >
          <Plus className="w-5 h-5 mr-2" />
          Nouvelle conversation
        </Button>
      </div>
    </div>
  );
}