import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Search, 
  RefreshCw, 
  Download, 
  Eye, 
  Settings,
  AlertCircle,
  FileText,
  Folder,
  User,
  Clock,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Email {
  id: number;
  subject: string;
  sender: string;
  senderEmail: string;
  content: string;
  date: string;
  time: string;
  priority: 'low' | 'medium' | 'high';
  hasAttachment: boolean;
  attachment?: {
    name: string;
    size: number;
    type: string;
    url: string;
  };
  folder?: {
    id: number;
    name: string;
    fileCount: number;
  };
  category: string;
}

export default function MailPageSimple() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const { toast } = useToast();

  // Récupérer l'utilisateur connecté
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
    staleTime: 5 * 60 * 1000,
  });

  // Fonction de chargement des courriers ULTRA SIMPLE
  const loadEmails = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      console.log('[SIMPLE-COURRIER] Chargement des courriers...');
      
      const response = await fetch('/api/files/shared', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-cache'
      });

      if (response.ok) {
        const data = await response.json();
        
        const allEmails: Email[] = [
          // Fichiers partagés
          ...data.files.map((file: any, index: number) => ({
            id: 1000 + index,
            subject: `Fichier partagé: ${file.name}`,
            sender: file.sharedBy?.displayName || 'Utilisateur',
            senderEmail: file.sharedBy?.username || 'user@rony.com',
            content: `Fichier "${file.name}" a été partagé avec vous.\n\nTaille: ${(file.size / 1024).toFixed(1)} KB\nType: ${file.type || 'Non spécifié'}\n\nCliquez pour télécharger.`,
            date: new Date(file.sharedAt).toLocaleDateString('fr-FR'),
            time: new Date(file.sharedAt).toLocaleTimeString('fr-FR'),
            priority: 'medium' as const,
            hasAttachment: true,
            attachment: {
              name: file.name,
              size: file.size,
              type: file.type,
              url: file.url
            },
            category: 'documents'
          })),
          // Dossiers partagés
          ...data.folders.map((folder: any, index: number) => ({
            id: 2000 + index,
            subject: `Dossier partagé: ${folder.name}`,
            sender: folder.sharedBy?.displayName || 'Utilisateur',
            senderEmail: folder.sharedBy?.username || 'user@rony.com',
            content: `Dossier "${folder.name}" a été partagé avec vous.\n\nContient plusieurs fichiers.\n\nCliquez pour explorer.`,
            date: new Date(folder.sharedAt).toLocaleDateString('fr-FR'),
            time: new Date(folder.sharedAt).toLocaleTimeString('fr-FR'),
            priority: 'medium' as const,  
            hasAttachment: true,
            folder: {
              id: folder.id,
              name: folder.name,
              fileCount: folder.fileCount || 0
            },
            category: 'documents'
          }))
        ];

        setEmails(allEmails);
        setLastUpdate(new Date());
        console.log(`[SIMPLE-COURRIER] ${allEmails.length} courriers chargés`);
      }
    } catch (error) {
      console.error('[SIMPLE-COURRIER] Erreur:', error);
      toast({
        title: 'Erreur de chargement',
        description: 'Impossible de charger les courriers',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Chargement initial et polling simple
  useEffect(() => {
    if (!user) return;

    // Chargement initial
    loadEmails();

    // Polling toutes les 5 secondes
    const interval = setInterval(loadEmails, 5000);

    return () => clearInterval(interval);
  }, [user]);

  // Filtrage des emails
  const filteredEmails = emails.filter(email => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      email.subject.toLowerCase().includes(query) ||
      email.sender.toLowerCase().includes(query) ||
      email.content.toLowerCase().includes(query)
    );
  });

  // Téléchargement de fichier
  const downloadFile = (attachment: any) => {
    if (attachment?.url) {
      window.open(attachment.url, '_blank');
    }
  };

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Connexion en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* En-tête */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-blue/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📧 Courrier</h1>
            <p className="text-sm text-gray-600">
              {filteredEmails.length} messages • Dernière mise à jour: {lastUpdate.toLocaleTimeString('fr-FR')}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Barre de recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-80 bg-white/80"
              />
            </div>
            
            {/* Bouton actualiser */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadEmails}
              disabled={isLoading}
              className="text-blue-700"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 overflow-hidden">
        {isLoading && emails.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <RefreshCw className="w-16 h-16 text-blue-400 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600">Chargement des courriers...</p>
            </div>
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun message</h3>
              <p className="text-gray-600">
                {searchQuery ? 'Aucun message trouvé pour cette recherche' : 'Votre boîte de courrier est vide'}
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4">
            <div className="space-y-3">
              {filteredEmails.map((email) => (
                <Card 
                  key={email.id} 
                  className="hover:shadow-md transition-all duration-200 cursor-pointer"
                  onClick={() => setSelectedEmail(email)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {email.hasAttachment && email.attachment && (
                            <FileText className="w-4 h-4 text-blue-600" />
                          )}
                          {email.hasAttachment && email.folder && (
                            <Folder className="w-4 h-4 text-yellow-600" />
                          )}
                          <h3 className="font-semibold text-gray-900">{email.subject}</h3>
                        </div>
                        
                        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                          <User className="w-4 h-4" />
                          <span>{email.sender}</span>
                          <Clock className="w-4 h-4 ml-4" />
                          <span>{email.date} à {email.time}</span>
                        </div>
                        
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {email.content.substring(0, 150)}...
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        {email.attachment && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadFile(email.attachment);
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        
                        <Badge variant="secondary">
                          {email.priority}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de lecture d'email */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  {selectedEmail.hasAttachment && selectedEmail.attachment && (
                    <FileText className="w-5 h-5 text-blue-600" />
                  )}
                  {selectedEmail.hasAttachment && selectedEmail.folder && (
                    <Folder className="w-5 h-5 text-yellow-600" />
                  )}
                  <span>{selectedEmail.subject}</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedEmail(null)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span>De: {selectedEmail.sender}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>{selectedEmail.date} à {selectedEmail.time}</span>
                  </div>
                </div>
                
                <hr />
                
                <div className="whitespace-pre-wrap text-gray-800">
                  {selectedEmail.content}
                </div>
                
                {selectedEmail.attachment && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Pièce jointe:</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{selectedEmail.attachment.name}</p>
                        <p className="text-sm text-gray-600">
                          {(selectedEmail.attachment.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        onClick={() => downloadFile(selectedEmail.attachment)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Télécharger
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}