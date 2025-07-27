import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Mail, Search, Star, Archive, Trash2, Download, Reply, Forward, MoreVertical, Clock, User, Paperclip, ArrowLeft, Filter, RefreshCw } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface InternalMail {
  id: number;
  subject: string;
  content: string;
  attachmentType: string | null;
  attachmentId: number | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  isRead: boolean;
  isStarred: boolean;
  sentAt: string;
  fromUser: {
    id: number;
    username: string;
    displayName: string;
  };
}

export default function InternalMailPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred' | 'attachments'>('all');
  const [selectedMail, setSelectedMail] = useState<InternalMail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const queryClient = useQueryClient();

  // Récupérer les messages internes
  const { data: mails = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/internal-mail/inbox'],
    queryFn: async () => {
      const response = await fetch('/api/internal-mail/inbox', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Impossible de récupérer les messages');
      return response.json();
    },
    refetchOnWindowFocus: true,
    staleTime: 1000 * 30 // 30 secondes
  });

  // Marquer comme lu
  const markAsReadMutation = useMutation({
    mutationFn: async (mailId: number) => {
      const response = await fetch(`/api/internal-mail/${mailId}/read`, {
        method: 'PUT',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Erreur lors du marquage');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal-mail/inbox'] });
    }
  });

  // Ouvrir le détail d'un message
  const handleOpenMail = (mail: InternalMail) => {
    setSelectedMail(mail);
    setIsDetailOpen(true);
    
    // Marquer comme lu si pas encore lu
    if (!mail.isRead) {
      markAsReadMutation.mutate(mail.id);
    }
  };

  // Filtrer les messages
  const filteredMails = mails.filter((mail: InternalMail) => {
    // Filtre de recherche
    if (searchTerm && !mail.subject.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !mail.fromUser.displayName.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Filtres spéciaux
    switch (filter) {
      case 'unread':
        return !mail.isRead;
      case 'starred':
        return mail.isStarred;
      case 'attachments':
        return mail.attachmentType !== null;
      default:
        return true;
    }
  });

  // Formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 jours
      return date.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }
  };

  // Formater la taille de fichier
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Télécharger une pièce jointe
  const handleDownloadAttachment = (mail: InternalMail) => {
    if (mail.attachmentType && mail.attachmentId) {
      const url = mail.attachmentType === 'file' 
        ? `/api/files/${mail.attachmentId}/download`
        : `/api/folders/${mail.attachmentId}/download`;
      window.open(url, '_blank');
    }
  };

  const unreadCount = mails.filter((mail: InternalMail) => !mail.isRead).length;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Courrier Interne</h1>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {unreadCount} nouveau{unreadCount > 1 ? 'x' : ''}
              </Badge>
            )}
          </div>
          
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Barre de recherche et filtres */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Rechercher dans les messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filtrer
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilter('all')}>
                Tous les messages
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('unread')}>
                Non lus
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('starred')}>
                Favoris
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('attachments')}>
                Avec pièces jointes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Liste des messages */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Chargement des messages...</p>
          </div>
        ) : filteredMails.length === 0 ? (
          <div className="p-8 text-center">
            <Mail className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun message</h3>
            <p className="text-gray-500">
              {searchTerm || filter !== 'all' 
                ? 'Aucun message ne correspond à vos critères de recherche.' 
                : 'Vous n\'avez pas encore reçu de messages internes.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredMails.map((mail: InternalMail) => (
              <div
                key={mail.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  !mail.isRead ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
                onClick={() => handleOpenMail(mail)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Avatar de l'expéditeur */}
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Expéditeur et date */}
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-sm ${!mail.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {mail.fromUser.displayName || mail.fromUser.username}
                        </p>
                        <div className="flex items-center gap-2">
                          {mail.attachmentType && (
                            <Paperclip className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="text-xs text-gray-500">
                            {formatDate(mail.sentAt)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Sujet */}
                      <p className={`text-sm mb-1 truncate ${!mail.isRead ? 'font-semibold text-gray-900' : 'text-gray-900'}`}>
                        {mail.subject}
                      </p>
                      
                      {/* Aperçu du contenu */}
                      <p className="text-sm text-gray-500 truncate">
                        {mail.content.substring(0, 100)}...
                      </p>
                      
                      {/* Pièce jointe */}
                      {mail.attachmentType && (
                        <div className="mt-2">
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                            <Paperclip className="h-3 w-3" />
                            {mail.attachmentName}
                            {mail.attachmentSize && ` (${formatFileSize(mail.attachmentSize)})`}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de détail du message */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Message de {selectedMail?.fromUser.displayName || selectedMail?.fromUser.username}
            </DialogTitle>
          </DialogHeader>
          
          {selectedMail && (
            <div className="space-y-6">
              {/* En-tête du message */}
              <div className="border-b border-gray-200 pb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {selectedMail.subject}
                </h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>De: {selectedMail.fromUser.displayName || selectedMail.fromUser.username}</span>
                  <span>•</span>
                  <span>Envoyé le {new Date(selectedMail.sentAt).toLocaleString('fr-FR')}</span>
                </div>
              </div>
              
              {/* Contenu du message */}
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {selectedMail.content}
                </div>
              </div>
              
              {/* Pièce jointe */}
              {selectedMail.attachmentType && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Paperclip className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {selectedMail.attachmentName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {selectedMail.attachmentType === 'file' ? 'Fichier' : 'Dossier'}
                          {selectedMail.attachmentSize && ` • ${formatFileSize(selectedMail.attachmentSize)}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleDownloadAttachment(selectedMail)}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}