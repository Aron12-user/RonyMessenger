import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Settings, UserPlus, Trash2, Crown, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConversationGroup, GroupMember } from "@shared/schema";

export default function GroupsPage() {
  const [selectedGroup, setSelectedGroup] = useState<ConversationGroup | null>(null);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<ConversationGroup | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Récupérer les groupes de l'utilisateur
  const { data: groups = [], isLoading } = useQuery<ConversationGroup[]>({
    queryKey: ['/api/groups'],
    queryFn: async () => {
      const response = await fetch('/api/groups', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Erreur lors de la récupération des groupes');
      return response.json();
    }
  });

  // Récupérer les membres d'un groupe
  const { data: groupMembers = [] } = useQuery<(GroupMember & { user: any })[]>({
    queryKey: ['/api/groups', selectedGroup?.id, 'members'],
    queryFn: async () => {
      if (!selectedGroup) return [];
      const response = await fetch(`/api/groups/${selectedGroup.id}/members`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Erreur lors de la récupération des membres');
      return response.json();
    },
    enabled: !!selectedGroup
  });

  // Mutation pour supprimer un groupe
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la suppression du groupe');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Groupe supprimé',
        description: 'Le groupe a été supprimé avec succès',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      setShowDeleteDialog(false);
      setGroupToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleViewMembers = (group: ConversationGroup) => {
    setSelectedGroup(group);
    setShowMembersDialog(true);
  };

  const handleDeleteGroup = (group: ConversationGroup) => {
    setGroupToDelete(group);
    setShowDeleteDialog(true);
  };

  const confirmDeleteGroup = () => {
    if (groupToDelete) {
      deleteGroupMutation.mutate(groupToDelete.id);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Chargement des groupes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mes Groupes</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Gérez vos groupes de conversation et leurs membres
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="px-3 py-1">
              <Users className="h-4 w-4 mr-1" />
              {groups.length} groupe{groups.length > 1 ? 's' : ''}
            </Badge>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucun groupe
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Vous ne faites partie d'aucun groupe pour le moment.
            </p>
            <p className="text-sm text-gray-400">
              Allez dans la section Contacts pour créer un nouveau groupe
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <Card key={group.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-semibold truncate">
                          {group.name}
                        </CardTitle>
                        {group.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                            {group.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      {group.isPrivate && (
                        <Badge variant="secondary" className="text-xs">
                          Privé
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>Créé le {formatDate(group.createdAt)}</span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewMembers(group)}
                        className="flex-1"
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Membres
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteGroup(group)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog des membres */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Membres de "{selectedGroup?.name}"</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="max-h-96 overflow-y-auto">
            {groupMembers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Aucun membre trouvé</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groupMembers.map((member) => (
                  <div key={member.id} className="flex items-center space-x-3 p-3 rounded-lg border">
                    <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                      {(member.user?.displayName || member.user?.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {member.user?.displayName || member.user?.username}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {member.user?.username}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {member.role === 'admin' ? (
                        <Badge variant="default" className="bg-yellow-100 text-yellow-800">
                          <Crown className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <User className="h-3 w-3 mr-1" />
                          Membre
                        </Badge>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatDate(member.joinedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMembersDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le groupe</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le groupe "{groupToDelete?.name}" ?
              Cette action est irréversible et supprimera toutes les données du groupe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGroup}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
              disabled={deleteGroupMutation.isPending}
            >
              {deleteGroupMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}