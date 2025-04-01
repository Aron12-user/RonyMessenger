import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS } from "@/lib/constants";

export default function Files() {
  const [selectedFile, setSelectedFile] = useState("");
  const [expirationDays, setExpirationDays] = useState("7");
  const [shareLink, setShareLink] = useState("");
  const { toast } = useToast();

  // Fetch files data
  const { data: files = [] } = useQuery({
    queryKey: [API_ENDPOINTS.FILES],
  });

  const handleUploadClick = () => {
    toast({
      title: "Upload functionality",
      description: "File upload feature would be implemented here"
    });
  };

  const handleGenerateLink = () => {
    // In a real app, this would call an API to generate a link
    const randomId = Math.random().toString(36).substring(2, 15);
    setShareLink(`https://rony.files/s/${randomId}`);
    
    toast({
      title: "Link generated",
      description: "Shareable link has been generated"
    });
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast({
        title: "Link copied",
        description: "Shareable link copied to clipboard"
      });
    }
  };

  return (
    <section className="flex-1 p-6 flex flex-col">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">File Sharing</h2>
            <Button 
              onClick={handleUploadClick}
              className="bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg flex items-center space-x-2"
            >
              <span className="material-icons">cloud_upload</span>
              <span>Upload File</span>
            </Button>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Recent Files</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Size</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Modified</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Shared With</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {files.length > 0 ? (
                    files.map((file: any) => (
                      <tr key={file.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className={`material-icons ${getFileIconColor(file.name)}`}>description</span>
                            <span className="font-medium ml-2">{file.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{file.size}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(file.modified)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex -space-x-2">
                            {file.sharedWith.map((user: any, index: number) => (
                              <UserAvatar key={index} initials={user.initials} color={user.color} size="sm" />
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-primary hover:text-primary-dark">Download</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        No files yet. Upload a file to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
            <h3 className="font-bold text-lg mb-4">Generate Shareable Link</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">Create a secure link to share files with external users. Links can be set to expire automatically.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">File Selection</label>
                <select 
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2"
                >
                  <option value="">Select a file</option>
                  <option value="project-proposal">Project Proposal.docx</option>
                  <option value="sales-report">Q3 Sales Report.xlsx</option>
                  <option value="mockups">Website Mockups.zip</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Expiration</label>
                <select 
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2"
                >
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="never">Never</option>
                </select>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <input 
                type="text" 
                value={shareLink} 
                placeholder="Generated link will appear here"
                readOnly 
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2" 
              />
              
              {!shareLink ? (
                <Button 
                  onClick={handleGenerateLink}
                  disabled={!selectedFile}
                  className="bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                >
                  <span className="material-icons">link</span>
                  <span>Generate Link</span>
                </Button>
              ) : (
                <Button 
                  onClick={handleCopyLink}
                  variant="outline"
                  className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                >
                  <span className="material-icons">content_copy</span>
                  <span>Copy Link</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Helper functions
function getFileIconColor(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'pdf': return 'text-red-500';
    case 'doc':
    case 'docx': return 'text-blue-500';
    case 'xls':
    case 'xlsx': return 'text-green-500';
    case 'ppt':
    case 'pptx': return 'text-orange-500';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif': return 'text-purple-500';
    case 'zip':
    case 'rar': return 'text-yellow-500';
    default: return 'text-gray-500';
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  
  // If today
  if (date.toDateString() === now.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // If yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Otherwise
  return date.toLocaleDateString([], { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}
