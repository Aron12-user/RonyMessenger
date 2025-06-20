import { useQuery } from '@tanstack/react-query';
import { Reply, Forward, ChevronDown, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SharedFile {
  id: number;
  name: string;
  type: string;
  size: number;
  url: string;
  uploaderId: number;
  uploadedAt: string;
  sharedBy?: {
    id: number;
    username: string;
    displayName: string;
  };
}

interface EmailItem {
  id: number;
  sender: string;
  senderEmail: string;
  subject: string;
  preview: string;
  date: string;
  hasAttachment: boolean;
  isRead: boolean;
  attachment?: SharedFile;
}

export default function MailPage() {
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);

  const { data: sharedFiles, isLoading } = useQuery<SharedFile[]>({
    queryKey: ['/api/files/shared'],
  });

  // Transformer les fichiers partagés en emails
  const emails: EmailItem[] = sharedFiles?.map((file, index) => {
    const senderName = file.sharedBy?.displayName || 'Utilisateur inconnu';
    const senderEmail = file.sharedBy?.username || 'user@rony.com';
    
    return {
      id: file.id,
      sender: senderName,
      senderEmail: senderEmail,
      subject: `Partage de fichier: ${file.name}`,
      preview: `${senderName} a partagé un fichier avec vous`,
      date: new Date(file.uploadedAt).toLocaleDateString('fr-FR'),
      hasAttachment: true,
      isRead: index > 0, // Premier email non lu pour la démo
      attachment: file
    };
  }) || [];

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'Ko', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="h-full bg-white">
        <div className="animate-pulse p-4">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header avec colonnes */}
      <div className="border-b px-4 py-2 bg-gray-50">
        <div className="flex items-center text-sm font-medium text-gray-700">
          <div className="w-48 flex-shrink-0">De</div>
          <div className="flex-1">Objet</div>
          <div className="w-24 flex items-center justify-end">
            <span>Reçu</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </div>
        </div>
      </div>

      {/* Liste des emails */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y">
            {emails.map((email) => (
              <div
                key={email.id}
                className={cn(
                  "px-4 py-3 hover:bg-gray-50 cursor-pointer border-l-4 transition-colors",
                  !email.isRead ? "bg-blue-50 border-l-blue-500 font-medium" : "border-l-transparent",
                  selectedEmail?.id === email.id && "bg-blue-100"
                )}
                onClick={() => setSelectedEmail(email)}
              >
                <div className="flex items-center">
                  {/* Avatar et expéditeur */}
                  <div className="w-48 flex-shrink-0 flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-orange-800">
                        {email.sender.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-gray-900 truncate">
                      {email.sender}
                    </span>
                  </div>

                  {/* Objet et aperçu avec pièce jointe */}
                  <div className="flex-1 min-w-0 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-900 truncate">
                        {email.subject}
                      </span>
                      {email.hasAttachment && (
                        <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600 truncate mt-1">
                      {email.preview}
                    </div>
                    {email.attachment && (
                      <div className="mt-1">
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded inline-flex items-center">
                          📎 {email.attachment.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <div className="w-24 text-sm text-gray-500 text-right flex-shrink-0">
                    {email.date}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panneau de lecture d'email sélectionné */}
        {selectedEmail && (
          <div className="border-t bg-white">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {selectedEmail.sender.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {selectedEmail.sender} &lt;{selectedEmail.senderEmail}&gt;
                    </div>
                    <div className="text-sm text-gray-600">
                      À : vous
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  Ven {selectedEmail.date} 11:06
                </div>
              </div>

              {selectedEmail.attachment && (
                <div className="mb-4">
                  <div className="flex items-center space-x-3 p-3 border rounded-lg bg-gray-50">
                    <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                      <span className="text-red-600 text-xs font-medium">PDF</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {selectedEmail.attachment.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatFileSize(selectedEmail.attachment.size)}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <p className="text-sm text-gray-900">
                  Bonne réception
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Reply className="w-4 h-4 mr-2" />
                  Répondre
                </Button>
                <Button variant="outline" size="sm">
                  <Forward className="w-4 h-4 mr-2" />
                  Transférer
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}