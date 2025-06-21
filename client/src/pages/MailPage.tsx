import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Reply, 
  Forward, 
  ChevronDown, 
  Paperclip, 
  Search,
  Filter,
  Archive,
  Trash2,
  Star,
  MoreHorizontal,
  Download,
  Eye,
  FolderOpen,
  FileText,
  Image,
  Video,
  Music,
  Package,
  Clock,
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Mail,
  MailOpen,
  RotateCcw,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

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

interface SharedFolder {
  id: number;
  name: string;
  fileCount: number;
  totalSize: number;
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
  content: string;
  date: string;
  time: string;
  hasAttachment: boolean;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  priority: 'high' | 'medium' | 'low';
  category: 'files' | 'folders' | 'documents' | 'media';
  attachment?: SharedFile;
  folder?: SharedFolder;
}

export default function MailPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'files' | 'folders' | 'documents' | 'media'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'reading'>('list');
  const [emailStates, setEmailStates] = useState<Map<number, Partial<EmailItem>>>(new Map());
  const [realtimeEmails, setRealtimeEmails] = useState<EmailItem[]>([]);
  const [persistentEmails, setPersistentEmails] = useState<EmailItem[]>([]);
  
  // États pour les boîtes de dialogue
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [forwardMessage, setForwardMessage] = useState('');
  const [forwardRecipient, setForwardRecipient] = useState('');

  const { data: sharedData, isLoading, refetch } = useQuery<{files: SharedFile[], folders: SharedFolder[]}>({
    queryKey: ['/api/files/shared'],
    refetchInterval: 30000,
  });

  const sharedFiles = sharedData?.files || [];
  const sharedFolders = sharedData?.folders || [];

  // Écouter les messages en temps réel via WebSocket avec reconnection automatique
  useEffect(() => {
    if (!user) return;

    let socket: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;
    let isConnected = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('WebSocket connecté pour notifications courrier');
        isConnected = true;
        reconnectAttempts = 0;
        
        // Authentifier l'utilisateur immédiatement
        socket.send(JSON.stringify({
          type: 'authenticate',
          data: { userId: user.id }
        }));
      };

      socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'courrier_message' && data.data.recipientId === user.id) {
          const messageData = data.data;
          
          const uniqueId = Date.now() + Math.floor(Math.random() * 1000000);
          
          let newEmail: EmailItem;
          
          if (messageData.type === 'reply') {
            // Message de réponse simple
            newEmail = {
              id: uniqueId,
              sender: messageData.sender,
              senderEmail: messageData.senderEmail,
              subject: messageData.subject,
              preview: `${messageData.sender} a répondu : ${messageData.message.substring(0, 100)}...`,
              content: messageData.message,
              date: new Date(messageData.timestamp).toLocaleDateString('fr-FR'),
              time: new Date(messageData.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              hasAttachment: false,
              isRead: false,
              isStarred: false,
              isArchived: false,
              isDeleted: false,
              priority: messageData.priority || 'medium',
              category: 'documents'
            };
          } else if (messageData.type === 'forward') {
            // Message transféré avec tout le contenu
            newEmail = {
              id: uniqueId,
              sender: messageData.sender,
              senderEmail: messageData.senderEmail,
              subject: messageData.subject,
              preview: `${messageData.sender} vous a transféré un message avec ${messageData.originalEmail?.attachment ? 'fichier' : messageData.originalEmail?.folder ? 'dossier' : 'contenu'}`,
              content: `${messageData.message}\n\n--- Message transféré ---\nDe: ${messageData.originalEmail?.sender}\nObjet: ${messageData.originalEmail?.subject}\n\n${messageData.originalEmail?.content}`,
              date: new Date(messageData.timestamp).toLocaleDateString('fr-FR'),
              time: new Date(messageData.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              hasAttachment: !!(messageData.originalEmail?.attachment || messageData.originalEmail?.folder),
              isRead: false,
              isStarred: false,
              isArchived: false,
              isDeleted: false,
              priority: messageData.priority || 'medium',
              category: messageData.originalEmail?.attachment ? 'files' : messageData.originalEmail?.folder ? 'folders' : 'documents',
              attachment: messageData.originalEmail?.attachment,
              folder: messageData.originalEmail?.folder
            };
          } else {
            // Message de partage de fichier/dossier (existant)
            newEmail = {
              id: uniqueId,
              sender: messageData.sender,
              senderEmail: messageData.senderEmail,
              subject: messageData.subject,
              preview: `${messageData.sender} vous a envoyé ${messageData.type === 'folder' ? 'un dossier' : 'un fichier'}. ${messageData.message.substring(0, 100)}...`,
              content: messageData.message,
              date: new Date(messageData.timestamp).toLocaleDateString('fr-FR'),
              time: new Date(messageData.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              hasAttachment: true,
              isRead: false,
              isStarred: false,
              isArchived: false,
              isDeleted: false,
              priority: 'high',
              category: messageData.type === 'folder' ? 'folders' : 'files',
              attachment: messageData.type === 'file' ? {
                id: messageData.fileId,
                name: messageData.fileName,
                type: messageData.fileType,
                size: messageData.fileSize,
                url: messageData.fileUrl,
                uploaderId: 0,
                uploadedAt: messageData.timestamp,
                sharedBy: {
                  id: 0,
                  username: messageData.senderEmail,
                  displayName: messageData.sender
                }
              } : undefined,
              folder: messageData.type === 'folder' ? {
                id: messageData.folderId,
                name: messageData.folderName,
                fileCount: messageData.fileCount,
                totalSize: messageData.totalSize,
                uploaderId: 0,
                uploadedAt: messageData.timestamp,
                sharedBy: {
                  id: 0,
                  username: messageData.senderEmail,
                  displayName: messageData.sender
                }
              } : undefined
            };
          }

          // Déduplication stricte pour éviter les doublons
          setPersistentEmails(prev => {
            const exists = prev.some(email => 
              email.id === newEmail.id || 
              (email.sender === newEmail.sender && 
               email.subject === newEmail.subject &&
               email.date === newEmail.date &&
               email.time === newEmail.time)
            );
            
            if (exists) {
              console.log('Email doublon détecté, ignoré');
              return prev;
            }
            
            const updatedEmails = [newEmail, ...prev];
            
            try {
              localStorage.setItem(`courrier_${user.id}`, JSON.stringify(updatedEmails));
              console.log(`✓ Email unique reçu. Total: ${updatedEmails.length} emails`);
            } catch (error) {
              console.error('Erreur lors de la sauvegarde:', error);
            }
            
            return updatedEmails;
          });
          
          // Notification appropriée selon le type de message
          if (messageData.type === 'reply') {
            toast({
              title: "Nouvelle réponse reçue",
              description: `${messageData.sender} a répondu à votre message`,
            });
          } else if (messageData.type === 'forward') {
            toast({
              title: "Message transféré reçu",
              description: `${messageData.sender} vous a transféré un message`,
            });
          } else {
            toast({
              title: "Nouveau message reçu",
              description: `${messageData.sender} vous a envoyé ${messageData.type === 'folder' ? 'un dossier' : 'un fichier'}`,
            });
          }
          
          // Forcer la mise à jour immédiate de l'interface
          queryClient.invalidateQueries({ queryKey: ['/api/files/shared'] });
          
          // Forcer un re-rendu immédiat de la liste d'emails
          setTimeout(() => {
            setRealtimeEmails(current => [...current]);
            setPersistentEmails(current => [...current]);
          }, 50);
        }
      } catch (error) {
        console.error('Erreur lors du traitement du message WebSocket:', error);
      }
    };

      socket.onclose = () => {
        console.log('WebSocket fermé, tentative de reconnection...');
        isConnected = false;
        
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          reconnectTimeout = setTimeout(() => {
            console.log(`Reconnection WebSocket (tentative ${reconnectAttempts}/${maxReconnectAttempts})...`);
            connectWebSocket();
          }, delay);
        }
      };

      socket.onerror = (error) => {
        console.error('Erreur WebSocket:', error);
        isConnected = false;
      };
    };

    // Démarrer la connexion initiale
    connectWebSocket();

    return () => {
      isConnected = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [user, toast, queryClient]);

  // Charger les emails persistants depuis localStorage au démarrage
  useEffect(() => {
    if (!user) return;
    
    // Charger les emails
    const savedEmails = localStorage.getItem(`courrier_${user.id}`);
    if (savedEmails) {
      try {
        const emails = JSON.parse(savedEmails);
        setPersistentEmails(emails);
        console.log(`${emails.length} emails chargés depuis localStorage`);
      } catch (error) {
        console.error('Erreur lors du chargement des emails:', error);
      }
    } else {
      // Initialiser avec quelques emails de démonstration si aucun email n'existe
      const demoEmails: EmailItem[] = [
        {
          id: Date.now() + 1,
          sender: 'Marie Dupont',
          senderEmail: 'marie.dupont@example.com',
          subject: 'Document partagé: Rapport mensuel',
          preview: 'Marie Dupont vous a envoyé un fichier. Voici le rapport mensuel que vous aviez demandé...',
          content: 'Bonjour, Voici le rapport mensuel que vous aviez demandé. Merci de me confirmer sa réception.',
          date: new Date().toLocaleDateString('fr-FR'),
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          hasAttachment: true,
          isRead: false,
          isStarred: false,
          isArchived: false,
          isDeleted: false,
          priority: 'high',
          category: 'documents'
        },
        {
          id: Date.now() + 2,
          sender: 'Jean Martin',
          senderEmail: 'jean.martin@example.com',
          subject: 'Photos de vacances',
          preview: 'Jean Martin vous a envoyé un dossier. Voici les photos de nos dernières vacances...',
          content: 'Salut ! Voici les photos de nos dernières vacances. J\'espère qu\'elles te plairont !',
          date: new Date(Date.now() - 86400000).toLocaleDateString('fr-FR'),
          time: new Date(Date.now() - 86400000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          hasAttachment: true,
          isRead: true,
          isStarred: true,
          isArchived: false,
          isDeleted: false,
          priority: 'medium',
          category: 'media'
        },
        {
          id: Date.now() + 3,
          sender: 'Sophie Bernard',
          senderEmail: 'sophie.bernard@example.com',
          subject: 'Présentation projet',
          preview: 'Sophie Bernard vous a envoyé un fichier. La présentation pour la réunion de demain...',
          content: 'Voici la présentation pour la réunion de demain. Pouvez-vous la relire avant ?',
          date: new Date(Date.now() - 172800000).toLocaleDateString('fr-FR'),
          time: new Date(Date.now() - 172800000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          hasAttachment: true,
          isRead: false,
          isStarred: false,
          isArchived: false,
          isDeleted: false,
          priority: 'high',
          category: 'documents'
        }
      ];
      
      setPersistentEmails(demoEmails);
      localStorage.setItem(`courrier_${user.id}`, JSON.stringify(demoEmails));
      console.log('Emails de démonstration initialisés');
    }
    
    // Charger les états des emails
    const savedStates = localStorage.getItem(`courrier_states_${user.id}`);
    if (savedStates) {
      try {
        const statesObject = JSON.parse(savedStates);
        const statesMap = new Map<number, Partial<EmailItem>>();
        Object.entries(statesObject).forEach(([key, value]) => {
          statesMap.set(parseInt(key), value as Partial<EmailItem>);
        });
        setEmailStates(statesMap);
      } catch (error) {
        console.error('Erreur lors du chargement des états des emails:', error);
      }
    }
  }, [user]);

  // Fonctions utilitaires
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'Ko', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileCategory = (type: string): 'files' | 'folders' | 'documents' | 'media' => {
    if (type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')) {
      return 'media';
    }
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) {
      return 'documents';
    }
    return 'files';
  };

  const getFileTypeDescription = (type: string): string => {
    if (type.includes('pdf')) return 'Document PDF';
    if (type.includes('word') || type.includes('document')) return 'Document Word';
    if (type.includes('excel') || type.includes('spreadsheet')) return 'Feuille de calcul Excel';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'Présentation PowerPoint';
    if (type.startsWith('image/')) return 'Image';
    if (type.startsWith('video/')) return 'Vidéo';
    if (type.startsWith('audio/')) return 'Audio';
    return 'Fichier';
  };

  const generateEmailContent = (file?: SharedFile, folder?: SharedFolder): string => {
    if (folder) {
      return `Bonjour,

J'ai le plaisir de partager avec vous le dossier "${folder.name}" qui contient ${folder.fileCount} fichiers essentiels pour notre collaboration.

Ce dossier comprend :
• Documents de travail mis à jour
• Ressources et références importantes  
• Fichiers de configuration nécessaires
• Éléments visuels et graphiques

Taille totale : ${formatFileSize(folder.totalSize)}

Vous pouvez accéder à l'ensemble des fichiers directement depuis cette interface ou télécharger le dossier complet.

N'hésitez pas à me contacter si vous avez des questions ou besoin d'informations complémentaires.

Cordialement,`;
    } else if (file) {
      const fileType = getFileTypeDescription(file.type);
      return `Bonjour,

Je vous transmets le fichier "${file.name}" dont vous aurez besoin pour la suite de nos travaux.

Détails du fichier :
• Type : ${fileType}
• Taille : ${formatFileSize(file.size)}
• Format : ${file.type}

Ce document contient des informations importantes et mises à jour. Merci de bien vouloir en prendre connaissance dans les meilleurs délais.

Pour toute question concernant ce fichier ou son contenu, n'hésitez pas à me recontacter.

Bien cordialement,`;
    }
    return 'Contenu du message non disponible.';
  };

  // Transformer les fichiers et dossiers partagés en emails
  const fileEmails: EmailItem[] = sharedFiles?.map((file, index) => {
    const senderName = file.sharedBy?.displayName || 'Utilisateur inconnu';
    const senderEmail = file.sharedBy?.username || 'user@rony.com';
    const baseDate = new Date(file.uploadedAt);
    const emailState = emailStates.get(file.id) || {};
    
    return {
      id: file.id,
      sender: senderName,
      senderEmail: senderEmail,
      subject: `Partage de fichier : ${file.name}`,
      preview: `${senderName} a partagé "${file.name}" avec vous. Cliquez pour consulter le contenu complet.`,
      content: generateEmailContent(file),
      date: baseDate.toLocaleDateString('fr-FR'),
      time: baseDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      hasAttachment: true,
      isRead: emailState.isRead ?? (index > 1),
      isStarred: emailState.isStarred ?? false,
      isArchived: emailState.isArchived ?? false,
      isDeleted: emailState.isDeleted ?? false,
      priority: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
      category: getFileCategory(file.type),
      attachment: file
    };
  }) || [];

  const folderEmails: EmailItem[] = sharedFolders.map((folder, index) => {
    const senderName = folder.sharedBy?.displayName || 'Utilisateur inconnu';
    const senderEmail = folder.sharedBy?.username || 'user@rony.com';
    const baseDate = new Date(folder.uploadedAt);
    const emailState = emailStates.get(folder.id + 1000) || {};
    
    return {
      id: folder.id + 1000,
      sender: senderName,
      senderEmail: senderEmail,
      subject: `Partage de dossier : ${folder.name}`,
      preview: `${senderName} a partagé le dossier "${folder.name}" contenant ${folder.fileCount} fichiers avec vous.`,
      content: generateEmailContent(undefined, folder),
      date: baseDate.toLocaleDateString('fr-FR'),
      time: baseDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      hasAttachment: true,
      isRead: emailState.isRead ?? (index > 0),
      isStarred: emailState.isStarred ?? false,
      isArchived: emailState.isArchived ?? false,
      isDeleted: emailState.isDeleted ?? false,
      priority: 'high',
      category: 'folders',
      folder: folder
    };
  });

  const allEmails = [...persistentEmails, ...fileEmails, ...folderEmails]
    .filter(email => !emailStates.get(email.id)?.isDeleted && !email.isDeleted)
    .sort((a, b) => new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime());

  // Filtrer les emails
  const filteredEmails = allEmails.filter(email => {
    const matchesSearch = email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         email.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         email.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || email.category === filterCategory;
    const matchesArchived = showArchived ? email.isArchived : !email.isArchived;
    return matchesSearch && matchesCategory && matchesArchived;
  });

  // Fonction pour mettre à jour l'état d'un email avec persistance
  const updateEmailState = (emailId: number, updates: Partial<EmailItem>) => {
    setEmailStates(prev => {
      const newStates = new Map(prev);
      const currentState = newStates.get(emailId) || {};
      newStates.set(emailId, { ...currentState, ...updates });
      
      // Sauvegarder les états dans localStorage
      if (user) {
        const statesObject = Object.fromEntries(newStates);
        localStorage.setItem(`courrier_states_${user.id}`, JSON.stringify(statesObject));
      }
      
      return newStates;
    });
    
    // Mise à jour immédiate des emails persistants pour archivage et autres états
    if (updates.isArchived || updates.isStarred !== undefined || updates.isRead !== undefined) {
      setPersistentEmails(prev => {
        const updatedEmails = prev.map(email => 
          email.id === emailId ? { ...email, ...updates } : email
        );
        
        if (user) {
          localStorage.setItem(`courrier_${user.id}`, JSON.stringify(updatedEmails));
          console.log(`Email ${emailId} ${updates.isArchived ? 'archivé' : 'mis à jour'}`);
        }
        
        return updatedEmails;
      });
    }

    // Si c'est une suppression, supprimer de persistentEmails
    if (updates.isDeleted) {
      setPersistentEmails(prev => {
        const filtered = prev.filter(email => email.id !== emailId);
        if (user) {
          localStorage.setItem(`courrier_${user.id}`, JSON.stringify(filtered));
        }
        return filtered;
      });
    }
  };

  // Mutations pour les actions réelles
  const markAsReadMutation = useMutation({
    mutationFn: async (emailId: number) => {
      updateEmailState(emailId, { isRead: true });
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files/shared'] });
    }
  });

  const starMutation = useMutation({
    mutationFn: async ({ emailId, isStarred }: { emailId: number, isStarred: boolean }) => {
      updateEmailState(emailId, { isStarred });
      return { success: true };
    },
    onSuccess: (_, { isStarred }) => {
      toast({ title: isStarred ? 'Ajouté aux favoris' : 'Retiré des favoris' });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (emailId: number) => {
      updateEmailState(emailId, { isArchived: true });
      return { success: true };
    },
    onSuccess: () => {
      toast({ title: 'Email archivé' });
      setSelectedEmail(null);
      setViewMode('list');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (emailId: number) => {
      updateEmailState(emailId, { isDeleted: true });
      return { success: true };
    },
    onSuccess: () => {
      toast({ title: 'Email supprimé' });
      setSelectedEmail(null);
      setViewMode('list');
    }
  });

  // Mutation pour envoyer une réponse
  const replyMutation = useMutation({
    mutationFn: async ({ recipientEmail, message, originalEmail }: { 
      recipientEmail: string, 
      message: string, 
      originalEmail: EmailItem 
    }) => {
      if (!user) throw new Error('Utilisateur non connecté');
      
      const response = await fetch('/api/courrier/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          message,
          originalSubject: originalEmail.subject,
          originalSender: originalEmail.sender,
          originalContent: originalEmail.content,
          senderName: user.displayName || user.username,
          senderEmail: user.email || `${user.username}@example.com`
        })
      });
      
      if (!response.ok) throw new Error('Erreur lors de l\'envoi de la réponse');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Réponse livrée instantanément', description: 'Votre message a été reçu par le destinataire' });
      setShowReplyDialog(false);
      setReplyMessage('');
    },
    onError: (error) => {
      console.error('Erreur livraison réponse:', error);
      toast({ title: 'Échec de livraison', description: 'Le message n\'a pas pu être livré. Réessayez.', variant: 'destructive' });
    }
  });

  // Mutation pour transférer un email
  const forwardMutation = useMutation({
    mutationFn: async ({ recipientEmail, message, originalEmail }: { 
      recipientEmail: string, 
      message: string, 
      originalEmail: EmailItem 
    }) => {
      if (!user) throw new Error('Utilisateur non connecté');
      
      const response = await fetch('/api/courrier/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          message,
          originalEmail: {
            subject: originalEmail.subject,
            sender: originalEmail.sender,
            senderEmail: originalEmail.senderEmail,
            content: originalEmail.content,
            date: originalEmail.date,
            time: originalEmail.time,
            attachment: originalEmail.attachment,
            folder: originalEmail.folder
          },
          senderName: user.displayName || user.username,
          senderEmail: user.email || `${user.username}@example.com`
        })
      });
      
      if (!response.ok) throw new Error('Erreur lors du transfert');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Transfert livré instantanément', description: 'Le message complet avec pièces jointes a été reçu' });
      setShowForwardDialog(false);
      setForwardMessage('');
      setForwardRecipient('');
    },
    onError: (error) => {
      console.error('Erreur transfert:', error);
      toast({ title: 'Échec de transfert', description: 'Le transfert n\'a pas pu être livré. Réessayez.', variant: 'destructive' });
    }
  });

  // Actions
  const handleEmailClick = (email: EmailItem) => {
    const currentEmail = getCurrentEmail(email);
    setSelectedEmail(currentEmail);
    setViewMode('reading');
    if (!currentEmail.isRead) {
      markAsReadMutation.mutate(email.id);
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedEmail(null);
  };

  const handleStarEmail = (emailId: number, currentStarred: boolean) => {
    starMutation.mutate({ emailId, isStarred: !currentStarred });
  };

  const handleArchiveEmail = (emailId: number) => {
    archiveMutation.mutate(emailId);
  };

  const handleDeleteEmail = (emailId: number) => {
    deleteMutation.mutate(emailId);
  };

  const handleRefresh = () => {
    refetch();
    toast({ title: 'Courrier actualisé' });
  };

  const handleReply = (email: EmailItem) => {
    setSelectedEmail(email);
    setShowReplyDialog(true);
  };

  const handleForward = (email: EmailItem) => {
    setSelectedEmail(email);
    setShowForwardDialog(true);
  };

  const handleSendReply = () => {
    if (!selectedEmail || !replyMessage.trim()) {
      toast({ title: 'Erreur', description: 'Veuillez saisir un message' });
      return;
    }
    
    replyMutation.mutate({
      recipientEmail: selectedEmail.senderEmail,
      message: replyMessage,
      originalEmail: selectedEmail
    });
  };

  const handleSendForward = () => {
    if (!selectedEmail || !forwardRecipient.trim()) {
      toast({ title: 'Erreur', description: 'Veuillez saisir l\'adresse du destinataire' });
      return;
    }
    
    forwardMutation.mutate({
      recipientEmail: forwardRecipient,
      message: forwardMessage || `Message transféré de ${selectedEmail.sender}`,
      originalEmail: selectedEmail
    });
  };

  const handleDownload = (item: SharedFile | SharedFolder) => {
    if ('url' in item) {
      const link = document.createElement('a');
      link.href = item.url;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: `Téléchargement de ${item.name} démarré` });
    } else {
      toast({ title: `Préparation du téléchargement du dossier ${item.name}...`, description: 'Le dossier sera compressé avant le téléchargement' });
    }
  };

  const handlePreview = (item: SharedFile | SharedFolder) => {
    if ('url' in item && (item.type.startsWith('image/') || item.type === 'application/pdf')) {
      window.open(item.url, '_blank');
    } else if ('fileCount' in item) {
      toast({ title: 'Exploration du dossier', description: `Ouverture du dossier ${item.name} avec ${item.fileCount} fichiers` });
    } else {
      toast({ title: 'Aperçu non disponible', description: 'Ce type de fichier ne peut pas être prévisualisé directement' });
    }
  };

  // Fonction pour obtenir l'icône selon le type
  const getItemIcon = (item: SharedFile | SharedFolder) => {
    if ('fileCount' in item) {
      return <FolderOpen className="w-5 h-5 text-blue-500" />;
    }
    
    const type = item.type;
    if (type.startsWith('image/')) return <Image className="w-5 h-5 text-green-500" />;
    if (type.startsWith('video/')) return <Video className="w-5 h-5 text-red-500" />;
    if (type.startsWith('audio/')) return <Music className="w-5 h-5 text-purple-500" />;
    if (type.includes('pdf') || type.includes('document')) return <FileText className="w-5 h-5 text-blue-500" />;
    if (type.includes('zip') || type.includes('rar')) return <Package className="w-5 h-5 text-orange-500" />;
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'medium': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'low': return <Mail className="w-4 h-4 text-green-500" />;
      default: return null;
    }
  };

  // Obtenir l'email actuel avec l'état mis à jour
  const getCurrentEmail = (email: EmailItem): EmailItem => {
    const emailState = emailStates.get(email.id) || {};
    return { ...email, ...emailState };
  };

  const unreadCount = filteredEmails.filter(email => !getCurrentEmail(email).isRead).length;
  const starredCount = filteredEmails.filter(email => getCurrentEmail(email).isStarred).length;

  if (isLoading) {
    return (
      <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <Mail className="h-12 w-12 mx-auto mb-4 text-gray-400 animate-pulse" />
          <p className="text-gray-600">Chargement du courrier...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col">
      {viewMode === 'list' ? (
        <>
          {/* Barre d'outils moderne */}
          <div className="border-b bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3">
                  {showArchived && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowArchived(false)}
                      className="mr-2"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Retour
                    </Button>
                  )}
                  <Mail className="h-8 w-8 text-blue-600" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      {showArchived ? 'Archives du courrier' : 'Courrier'}
                    </h1>
                    <p className="text-sm text-gray-600">
                      {showArchived ? 'Messages archivés' : 'Gestion des fichiers et dossiers partagés'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <Badge variant="secondary" className="px-3 py-1">
                    {unreadCount} non lus
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1">
                    {starredCount} favoris
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1">
                    {filteredEmails.length} total
                  </Badge>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Actualiser
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Options
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setShowArchived(!showArchived)}>
                      <Archive className="w-4 h-4 mr-2" />
                      {showArchived ? 'Masquer archivés' : 'Afficher archivés'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Settings className="w-4 h-4 mr-2" />
                      Paramètres du courrier
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Rechercher dans le courrier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Tabs value={filterCategory} onValueChange={(value) => setFilterCategory(value as any)}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="all">Tous</TabsTrigger>
                  <TabsTrigger value="files">Fichiers</TabsTrigger>
                  <TabsTrigger value="folders">Dossiers</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="media">Médias</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Header avec colonnes */}
          <div className="border-b bg-gray-50 overflow-x-auto flex-shrink-0">
            <div className="flex items-center text-sm font-medium text-gray-700 px-6 py-3" style={{ minWidth: '1000px' }}>
              <div className="w-64 flex-shrink-0">Expéditeur</div>
              <div className="w-96 flex-shrink-0">Objet</div>
              <div className="w-24 text-center flex-shrink-0">Priorité</div>
              <div className="w-32 flex items-center justify-end flex-shrink-0">
                <span>Date</span>
                <ChevronDown className="w-4 h-4 ml-1" />
              </div>
              <div className="w-20 text-center flex-shrink-0">Actions</div>
              <div className="w-16 flex-shrink-0"></div>
            </div>
          </div>

          {/* Liste des emails avec défilement horizontal et vertical */}
          <div className="flex-1 overflow-auto">
            <div className="divide-y" style={{ minWidth: '1000px' }}>
              {filteredEmails.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <Mail className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-xl font-medium text-gray-600 mb-2">
                    Aucun courrier trouvé
                  </h3>
                  <p className="text-gray-500">
                    {searchQuery ? 'Aucun résultat ne correspond à votre recherche' : 'Votre boîte de courrier est vide'}
                  </p>
                </div>
              ) : (
                filteredEmails.map((email) => {
                  const currentEmail = getCurrentEmail(email);
                  return (
                    <div
                      key={email.id}
                      className={cn(
                        "px-6 py-4 hover:bg-blue-50 cursor-pointer border-l-4 transition-all duration-200",
                        !currentEmail.isRead ? "bg-blue-50 border-l-blue-500 font-medium" : "border-l-transparent",
                        currentEmail.isStarred && "bg-yellow-50",
                        "px-0 py-0"
                      )}
                      onClick={() => handleEmailClick(email)}
                    >
                      <div className="flex items-center px-6 py-4" style={{ minWidth: '1000px' }}>
                        {/* Avatar et expéditeur */}
                        <div className="w-64 flex-shrink-0 flex items-center space-x-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                            email.category === 'folders' ? "bg-blue-200" : "bg-orange-200"
                          )}>
                            <span className={cn(
                              "text-sm font-medium",
                              email.category === 'folders' ? "text-blue-800" : "text-orange-800"
                            )}>
                              {email.sender.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {email.sender}
                              </span>
                              {currentEmail.isStarred && (
                                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                              )}
                            </div>
                            <span className="text-xs text-gray-500 truncate block">
                              {email.senderEmail}
                            </span>
                          </div>
                        </div>

                        {/* Objet et aperçu */}
                        <div className="w-96 flex-shrink-0 px-4">
                          <div className="flex items-center space-x-2">
                            <span className={cn(
                              "text-sm truncate",
                              !currentEmail.isRead ? "font-semibold text-gray-900" : "text-gray-700"
                            )}>
                              {email.subject}
                            </span>
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              {email.hasAttachment && (
                                <Paperclip className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 mt-1 truncate">
                            {email.preview}
                          </div>
                        </div>

                        {/* Priorité */}
                        <div className="w-24 flex justify-center flex-shrink-0">
                          {getPriorityIcon(email.priority)}
                        </div>

                        {/* Date */}
                        <div className="w-32 text-right flex-shrink-0">
                          <div className="text-sm text-gray-900">{email.date}</div>
                          <div className="text-xs text-gray-500">{email.time}</div>
                        </div>

                        {/* Actions */}
                        <div className="w-20 flex justify-center flex-shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleStarEmail(email.id, currentEmail.isStarred);
                              }}>
                                <Star className="w-4 h-4 mr-2" />
                                {currentEmail.isStarred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveEmail(email.id);
                              }}>
                                <Archive className="w-4 h-4 mr-2" />
                                Archiver
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEmail(email.id);
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        {/* Espace supplémentaire pour éviter la coupure */}
                        <div className="w-16 flex-shrink-0"></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : (
        /* Mode de lecture avec défilement */
        <div className="h-full flex flex-col">
          {/* Header de lecture */}
          <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={handleBackToList}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour à la liste
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  {filteredEmails.findIndex(e => e.id === selectedEmail?.id) + 1} sur {filteredEmails.length}
                </span>
                <Button variant="ghost" size="sm">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {selectedEmail && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleStarEmail(selectedEmail.id, getCurrentEmail(selectedEmail).isStarred)}
                  >
                    <Star className={cn(
                      "w-4 h-4", 
                      getCurrentEmail(selectedEmail).isStarred ? "text-yellow-500 fill-current" : "text-gray-400"
                    )} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleArchiveEmail(selectedEmail.id)}>
                    <Archive className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteEmail(selectedEmail.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Contenu de lecture avec défilement */}
          <ScrollArea className="flex-1">
            {selectedEmail && (
              <div className="max-w-4xl mx-auto p-6">
                {/* En-tête du message */}
                <Card className="mb-6">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-start space-x-4">
                        <div className={cn(
                          "w-16 h-16 rounded-full flex items-center justify-center",
                          selectedEmail.category === 'folders' ? "bg-blue-500" : "bg-orange-500"
                        )}>
                          <span className="text-white font-bold text-lg">
                            {selectedEmail.sender.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            {selectedEmail.subject}
                          </h2>
                          <div className="space-y-1">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">De :</span> {selectedEmail.sender} &lt;{selectedEmail.senderEmail}&gt;
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">À :</span> vous
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{selectedEmail.date} à {selectedEmail.time}</span>
                              </div>
                              {selectedEmail.priority === 'high' && (
                                <Badge variant="destructive" className="text-xs">
                                  Priorité élevée
                                </Badge>
                              )}
                              {getCurrentEmail(selectedEmail).isStarred && (
                                <Badge variant="secondary" className="text-xs">
                                  Favori
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contenu du message */}
                    <div className="prose max-w-none">
                      <div className="whitespace-pre-line text-gray-700 leading-relaxed">
                        {selectedEmail.content}
                      </div>
                    </div>

                    {/* Pièce jointe ou dossier */}
                    {(selectedEmail.attachment || selectedEmail.folder) && (
                      <div className="mt-8">
                        <h4 className="text-lg font-medium text-gray-900 mb-4">
                          {selectedEmail.folder ? 'Dossier partagé' : 'Pièce jointe'}
                        </h4>
                        <Card className="p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center space-x-4">
                            {selectedEmail.attachment && (
                              <>
                                {getItemIcon(selectedEmail.attachment)}
                                <div className="flex-1">
                                  <div className="text-base font-medium text-gray-900">
                                    {selectedEmail.attachment.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {formatFileSize(selectedEmail.attachment.size)} • {getFileTypeDescription(selectedEmail.attachment.type)}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <Button 
                                    variant="outline"
                                    onClick={() => handlePreview(selectedEmail.attachment!)}
                                  >
                                    <Eye className="w-4 h-4 mr-2" />
                                    Aperçu
                                  </Button>
                                  <Button 
                                    onClick={() => handleDownload(selectedEmail.attachment!)}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Télécharger
                                  </Button>
                                </div>
                              </>
                            )}
                            {selectedEmail.folder && (
                              <>
                                <FolderOpen className="w-12 h-12 text-blue-500" />
                                <div className="flex-1">
                                  <div className="text-base font-medium text-gray-900">
                                    {selectedEmail.folder.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {selectedEmail.folder.fileCount} fichiers • {formatFileSize(selectedEmail.folder.totalSize)}
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    Dossier complet avec tous les fichiers associés
                                  </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <Button 
                                    variant="outline"
                                    onClick={() => handlePreview(selectedEmail.folder!)}
                                  >
                                    <Eye className="w-4 h-4 mr-2" />
                                    Explorer
                                  </Button>
                                  <Button 
                                    onClick={() => handleDownload(selectedEmail.folder!)}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Télécharger tout
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </Card>
                      </div>
                    )}

                    {/* Actions du message */}
                    <div className="flex items-center space-x-3 pt-6 border-t mt-8">
                      <Button onClick={() => handleReply(selectedEmail)}>
                        <Reply className="w-4 h-4 mr-2" />
                        Répondre
                      </Button>
                      <Button variant="outline" onClick={() => handleForward(selectedEmail)}>
                        <Forward className="w-4 h-4 mr-2" />
                        Transférer
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => handleArchiveEmail(selectedEmail.id)}
                      >
                        <Archive className="w-4 h-4 mr-2" />
                        Archiver
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => handleStarEmail(selectedEmail.id, getCurrentEmail(selectedEmail).isStarred)}
                      >
                        <Star className="w-4 h-4 mr-2" />
                        {getCurrentEmail(selectedEmail).isStarred ? 'Retirer des favoris' : 'Marquer comme favori'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Boîte de dialogue pour Répondre */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Reply className="w-5 h-5 text-blue-500" />
              <span>Répondre à {selectedEmail?.sender}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Informations sur l'email original */}
            {selectedEmail && (
              <div className="bg-gray-50 p-3 rounded-lg border">
                <div className="text-sm font-medium text-gray-900 mb-1">
                  Re: {selectedEmail.subject}
                </div>
                <div className="text-xs text-gray-500">
                  À: {selectedEmail.sender} &lt;{selectedEmail.senderEmail}&gt;
                </div>
              </div>
            )}

            {/* Zone de saisie du message de réponse */}
            <div className="space-y-2">
              <Label htmlFor="reply-message" className="text-sm font-medium">
                Votre réponse
              </Label>
              <Textarea
                id="reply-message"
                placeholder="Tapez votre réponse ici..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                className="min-h-24 resize-none"
              />
              <div className="text-xs text-gray-500">
                {replyMessage.length}/500 caractères
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowReplyDialog(false);
                  setReplyMessage('');
                }}
              >
                Annuler
              </Button>
              <Button 
                onClick={handleSendReply}
                disabled={replyMutation.isPending || !replyMessage.trim()}
                className="min-w-24"
              >
                {replyMutation.isPending ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Envoi...</span>
                  </div>
                ) : (
                  <>
                    <Reply className="w-4 h-4 mr-2" />
                    Envoyer
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Boîte de dialogue pour Transfert */}
      <Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
        <DialogContent className="max-w-sm max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Forward className="w-5 h-5 text-green-500" />
              <span>Transférer le message</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-3">
            {/* Destinataire */}
            <div className="space-y-2">
              <Label htmlFor="forward-recipient" className="text-sm font-medium">
                Destinataire <span className="text-red-500">*</span>
              </Label>
              <Input
                id="forward-recipient"
                type="email"
                placeholder="adresse@exemple.com"
                value={forwardRecipient}
                onChange={(e) => setForwardRecipient(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Message personnel */}
            <div className="space-y-2">
              <Label htmlFor="forward-message" className="text-sm font-medium">
                Message personnel (optionnel)
              </Label>
              <Textarea
                id="forward-message"
                placeholder="Message personnel..."
                value={forwardMessage}
                onChange={(e) => setForwardMessage(e.target.value)}
                className="min-h-16 resize-none text-sm"
              />
            </div>

            {/* Aperçu du message transféré */}
            {selectedEmail && (
              <div className="bg-gray-50 p-4 rounded-lg border">
                <div className="text-sm text-gray-600 mb-2">
                  <strong>Message transféré :</strong>
                </div>
                <div className="bg-white p-4 rounded border">
                  <div className="text-sm font-medium text-gray-900 mb-2">
                    Fwd: {selectedEmail.subject}
                  </div>
                  <div className="text-xs text-gray-500 space-y-1 mb-3">
                    <div>De: {selectedEmail.sender} &lt;{selectedEmail.senderEmail}&gt;</div>
                    <div>Date: {selectedEmail.date} à {selectedEmail.time}</div>
                  </div>
                  <Separator className="my-2" />
                  <div className="text-sm text-gray-700 max-h-32 overflow-y-auto">
                    {selectedEmail.content}
                  </div>
                  {(selectedEmail.attachment || selectedEmail.folder) && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-gray-500 mb-2">Pièce jointe :</div>
                      <div className="flex items-center space-x-2 text-sm">
                        {selectedEmail.attachment && (
                          <>
                            {getItemIcon(selectedEmail.attachment)}
                            <span>{selectedEmail.attachment.name}</span>
                            <span className="text-gray-500">({formatFileSize(selectedEmail.attachment.size)})</span>
                          </>
                        )}
                        {selectedEmail.folder && (
                          <>
                            <FolderOpen className="w-4 h-4 text-blue-500" />
                            <span>{selectedEmail.folder.name}</span>
                            <span className="text-gray-500">({selectedEmail.folder.fileCount} fichiers)</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowForwardDialog(false);
                  setForwardMessage('');
                  setForwardRecipient('');
                }}
              >
                Annuler
              </Button>
              <Button 
                onClick={handleSendForward}
                disabled={forwardMutation.isPending || !forwardRecipient.trim()}
                className="min-w-24"
              >
                {forwardMutation.isPending ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Envoi...</span>
                  </div>
                ) : (
                  <>
                    <Forward className="w-4 h-4 mr-2" />
                    Transférer
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}