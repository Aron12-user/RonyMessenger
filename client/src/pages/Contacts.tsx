import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import StatusIndicator from "@/components/StatusIndicator";
import { API_ENDPOINTS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { User } from "@shared/schema";

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Fetch contacts
  const { data: contacts = [] } = useQuery({
    queryKey: [API_ENDPOINTS.CONTACTS],
  });

  const handleAddContact = () => {
    toast({
      title: "Add Contact",
      description: "Contact creation would be implemented here",
    });
  };

  const handleMessage = (contact: User) => {
    toast({
      title: "Message",
      description: `Messaging ${contact.displayName || contact.username} would be implemented here`,
    });
  };

  const handleCall = (contact: User) => {
    toast({
      title: "Call",
      description: `Calling ${contact.displayName || contact.username} would be implemented here`,
    });
  };

  // Filter contacts based on search query
  const filteredContacts = contacts.filter((contact: User) => {
    const searchString = `${contact.displayName} ${contact.username} ${contact.email || ''}`.toLowerCase();
    return searchString.includes(searchQuery.toLowerCase());
  });

  return (
    <section className="flex-1 p-6 flex flex-col">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Contacts</h2>
            <div className="flex space-x-3">
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts..." 
                  className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                  <span className="material-icons text-sm">search</span>
                </span>
              </div>
              <Button 
                onClick={handleAddContact}
                className="bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg flex items-center space-x-2"
              >
                <span className="material-icons">person_add</span>
                <span>Add Contact</span>
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContacts.length > 0 ? (
              filteredContacts.map((contact: User) => (
                <div key={contact.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center mb-3">
                    <div className="relative">
                      <UserAvatar 
                        initials={`${contact.username.charAt(0)}${contact.username.charAt(Math.min(1, contact.username.length - 1))}`.toUpperCase()} 
                        color={getColorForUser(contact.id)}
                        size="lg"
                      />
                      <StatusIndicator status={contact.status} />
                    </div>
                    <div className="ml-3">
                      <h3 className="font-medium text-lg">{contact.displayName || contact.username}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{contact.title || 'User'}</p>
                    </div>
                    <button className="ml-auto p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                      <span className="material-icons">more_vert</span>
                    </button>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    {contact.email && (
                      <div className="flex items-center">
                        <span className="material-icons text-gray-400 mr-2 text-sm">email</span>
                        <span>{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center">
                        <span className="material-icons text-gray-400 mr-2 text-sm">call</span>
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 flex space-x-2">
                    <Button 
                      onClick={() => handleMessage(contact)}
                      variant="outline" 
                      className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary py-2 rounded flex items-center justify-center"
                    >
                      <span className="material-icons text-sm mr-1">chat</span>
                      <span>Message</span>
                    </Button>
                    <Button 
                      onClick={() => handleCall(contact)}
                      variant="outline" 
                      className="flex-1 bg-secondary/10 hover:bg-secondary/20 text-secondary py-2 rounded flex items-center justify-center"
                    >
                      <span className="material-icons text-sm mr-1">videocam</span>
                      <span>Call</span>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-8 text-gray-500 dark:text-gray-400">
                {searchQuery ? (
                  <p>No contacts match your search. Try different keywords.</p>
                ) : (
                  <div>
                    <span className="material-icons text-4xl mb-2">people</span>
                    <p className="text-lg mb-2">Your contacts list is empty</p>
                    <p>Add contacts to start messaging</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// Helper function
function getColorForUser(userId: number): 'blue' | 'green' | 'purple' | 'red' | 'yellow' {
  const colors = ['blue', 'green', 'purple', 'red', 'yellow'];
  return colors[userId % colors.length] as 'blue' | 'green' | 'purple' | 'red' | 'yellow';
}
