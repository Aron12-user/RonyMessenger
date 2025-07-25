import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Users, Search, UserPlus, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface Contact {
  id: number;
  username: string;
  displayName: string | null;
  avatar?: string | null;
  status: string;
}

interface CreateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
}

export default function CreateGroupDialog({ isOpen, onClose, contacts }: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createGroupMutation = useMutation({
    mutationFn: async (groupData: {
      name: string;
      description?: string;
      selectedContactIds: number[];
      isPrivate: boolean;
    }) => {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(groupData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création du groupe');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Groupe créé',
        description: `Le groupe "${data.name}" a été créé avec succès`,
      });
      
      // Invalider les caches
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      
      // Reset form
      setGroupName('');
      setDescription('');
      setIsPrivate(false);
      setSelectedContacts(new Set());
      setSearchTerm('');
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const filteredContacts = contacts.filter(contact =>
    contact.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleContactToggle = (contactId: number) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleSubmit = () => {
    if (!groupName.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le nom du groupe est requis',
        variant: 'destructive',
      });
      return;
    }

    if (selectedContacts.size === 0) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner au moins un contact',
        variant: 'destructive',
      });
      return;
    }

    createGroupMutation.mutate({
      name: groupName,
      description: description || undefined,
      selectedContactIds: Array.from(selectedContacts),
      isPrivate
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Créer un groupe de conversation</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations du groupe */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="groupName">Nom du groupe *</Label>
              <Input
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ex: Équipe Marketing, Famille..."
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description du groupe..."
                className="mt-1 resize-none"
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="private"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
              <Label htmlFor="private">Groupe privé</Label>
            </div>
          </div>

          {/* Sélection des contacts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Sélectionner les membres</Label>
              <span className="text-sm text-gray-500">
                {selectedContacts.size} sur {filteredContacts.length} sélectionné(s)
              </span>
            </div>

            {/* Barre de recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher des contacts..."
                className="pl-10"
              />
            </div>

            {/* Boutons de sélection */}
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="flex items-center space-x-1"
              >
                <Check className="h-4 w-4" />
                <span>
                  {selectedContacts.size === filteredContacts.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </span>
              </Button>
            </div>

            {/* Liste des contacts */}
            <ScrollArea className="h-60 border rounded-md">
              <div className="p-4 space-y-2">
                {filteredContacts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Aucun contact trouvé</p>
                  </div>
                ) : (
                  filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      onClick={() => handleContactToggle(contact.id)}
                    >
                      <Checkbox
                        checked={selectedContacts.has(contact.id)}
                        onChange={() => handleContactToggle(contact.id)}
                      />
                      
                      <div className="relative">
                        <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {(contact.displayName || contact.username).charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${getStatusColor(contact.status)}`}></div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {contact.displayName || contact.username}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {contact.username}
                        </p>
                      </div>
                      
                      <div className="text-xs text-gray-400">
                        {contact.status}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <div className="text-sm text-gray-500">
              {selectedContacts.size > 0 && (
                <span>{selectedContacts.size} contact(s) sélectionné(s)</span>
              )}
            </div>
            <div className="space-x-2">
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={createGroupMutation.isPending || !groupName.trim() || selectedContacts.size === 0}
              >
                {createGroupMutation.isPending ? 'Création...' : 'Créer le groupe'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}