import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { HardDrive, FileText, Folder, Upload, Download } from 'lucide-react';

interface CloudStorageStatsProps {
  stats: {
    used: number;
    total: number;
    files: number;
    folders: number;
    recentUploads?: number;
    recentDownloads?: number;
  };
  className?: string;
}

export default function CloudStorageStats({ stats, className = '' }: CloudStorageStatsProps) {
  const usagePercentage = stats.total > 0 ? (stats.used / stats.total) * 100 : 0;
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-lg">
          <HardDrive className="h-5 w-5 mr-2" />
          Espace de stockage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Utilisation du stockage */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Utilisé</span>
            <span className="font-medium">
              {formatBytes(stats.used)} / {formatBytes(stats.total)}
            </span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {usagePercentage.toFixed(1)}% utilisé
          </div>
        </div>

        {/* Statistiques des fichiers */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <FileText className="h-5 w-5 mx-auto mb-1 text-blue-600 dark:text-blue-400" />
            <div className="font-semibold text-lg text-blue-700 dark:text-blue-300">
              {stats.files}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400">
              Fichiers
            </div>
          </div>
          
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <Folder className="h-5 w-5 mx-auto mb-1 text-orange-600 dark:text-orange-400" />
            <div className="font-semibold text-lg text-orange-700 dark:text-orange-300">
              {stats.folders}
            </div>
            <div className="text-xs text-orange-600 dark:text-orange-400">
              Dossiers
            </div>
          </div>
        </div>

        {/* Activité récente */}
        {(stats.recentUploads !== undefined || stats.recentDownloads !== undefined) && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Activité récente (24h)
            </div>
            <div className="flex justify-between text-sm">
              {stats.recentUploads !== undefined && (
                <div className="flex items-center text-green-600 dark:text-green-400">
                  <Upload className="h-4 w-4 mr-1" />
                  {stats.recentUploads} uploads
                </div>
              )}
              {stats.recentDownloads !== undefined && (
                <div className="flex items-center text-blue-600 dark:text-blue-400">
                  <Download className="h-4 w-4 mr-1" />
                  {stats.recentDownloads} téléchargements
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}