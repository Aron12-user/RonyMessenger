import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { API_ENDPOINTS } from "@/lib/constants";

export default function CloudStorage() {
  const { toast } = useToast();

  // Fetch cloud storage data
  const { data: storageData } = useQuery({
    queryKey: ['/api/storage'],
  });

  const handleNewFolder = () => {
    toast({
      title: "Create Folder",
      description: "New folder creation would be implemented here",
    });
  };

  // Mock data for UI demonstration
  const usedSpace = 2.4;
  const totalSpace = 10;
  const usagePercentage = (usedSpace / totalSpace) * 100;

  const categories = [
    { name: "Documents", icon: "description", count: 245, size: "512 MB", color: "blue" },
    { name: "Images", icon: "image", count: 532, size: "1.2 GB", color: "green" },
    { name: "Videos", icon: "videocam", count: 32, size: "645 MB", color: "purple" },
  ];

  const recentFiles = [
    { name: "Marketing Strategy.docx", type: "document", size: "3.2 MB", modified: "2 days ago" },
    { name: "Office Meeting.jpg", type: "image", size: "1.8 MB", modified: "Aug 25" },
    { name: "Financial Report Q2.xlsx", type: "spreadsheet", size: "5.4 MB", modified: "Aug 22" },
  ];

  return (
    <section className="flex-1 p-6 flex flex-col">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Cloud Storage</h2>
            <Button 
              onClick={handleNewFolder}
              className="bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg flex items-center space-x-2"
            >
              <span className="material-icons">create_new_folder</span>
              <span>New Folder</span>
            </Button>
          </div>
          
          <div className="mb-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Storage Usage</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">{usedSpace} GB of {totalSpace} GB</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
              <div className="bg-primary h-2.5 rounded-full" style={{ width: `${usagePercentage}%` }}></div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {categories.map((category) => (
              <div key={category.name} className={`bg-${category.color}-50 dark:bg-${category.color}-900/20 rounded-lg p-4 flex items-center`}>
                <div className={`w-10 h-10 rounded-lg bg-${category.color}-100 dark:bg-${category.color}-800 flex items-center justify-center text-${category.color}-600 dark:text-${category.color}-300 mr-3`}>
                  <span className="material-icons">{category.icon}</span>
                </div>
                <div>
                  <h3 className="font-medium">{category.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{category.count} files • {category.size}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Recent Files</h3>
              <select className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1 text-sm">
                <option>All Files</option>
                <option>Documents</option>
                <option>Images</option>
                <option>Videos</option>
              </select>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentFiles.map((file) => (
                <div key={file.name} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-32 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <span className="material-icons text-4xl text-gray-400">
                      {file.type === 'document' ? 'description' : 
                       file.type === 'image' ? 'image' : 
                       file.type === 'spreadsheet' ? 'insert_chart' : 'insert_drive_file'}
                    </span>
                  </div>
                  <div className="p-3">
                    <h4 className="font-medium truncate">{file.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{file.size} • Modified {file.modified}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
