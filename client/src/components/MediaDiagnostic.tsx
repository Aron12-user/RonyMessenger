import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, Camera, Mic, Monitor } from "lucide-react";

interface MediaDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

interface DiagnosticResult {
  cameras: MediaDevice[];
  microphones: MediaDevice[];
  speakers: MediaDevice[];
  permissions: {
    camera: PermissionState;
    microphone: PermissionState;
  };
  testResults: {
    cameraTest: boolean;
    microphoneTest: boolean;
  };
}

export function MediaDiagnostic() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const runDiagnostic = async () => {
    setIsRunning(true);
    
    try {
      // Énumérer les périphériques
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = devices.filter(d => d.kind === 'videoinput');
      const microphones = devices.filter(d => d.kind === 'audioinput');
      const speakers = devices.filter(d => d.kind === 'audiooutput');

      // Vérifier les permissions
      let cameraPermission: PermissionState = 'prompt';
      let microphonePermission: PermissionState = 'prompt';

      if (navigator.permissions) {
        try {
          const camPerm = await navigator.permissions.query({ name: 'camera' as PermissionName });
          const micPerm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          cameraPermission = camPerm.state;
          microphonePermission = micPerm.state;
        } catch (e) {
          console.log('Permissions API non supportée');
        }
      }

      // Tester l'accès réel
      let cameraTest = false;
      let microphoneTest = false;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 320, height: 240 }, 
          audio: true 
        });
        
        cameraTest = stream.getVideoTracks().length > 0;
        microphoneTest = stream.getAudioTracks().length > 0;
        
        // Arrêter immédiatement le stream de test
        stream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.log('Test d\'accès échoué:', e);
      }

      const result: DiagnosticResult = {
        cameras,
        microphones,
        speakers,
        permissions: {
          camera: cameraPermission,
          microphone: microphonePermission
        },
        testResults: {
          cameraTest,
          microphoneTest
        }
      };

      setDiagnostic(result);

      // Messages de résultat
      if (cameraTest && microphoneTest) {
        toast({
          title: "Diagnostic réussi",
          description: "Caméra et microphone fonctionnent correctement"
        });
      } else {
        toast({
          title: "Problèmes détectés",
          description: "Vérifiez les permissions et les périphériques",
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Erreur diagnostic:', error);
      toast({
        title: "Erreur de diagnostic",
        description: "Impossible de tester les périphériques",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getPermissionBadge = (permission: PermissionState) => {
    switch (permission) {
      case 'granted':
        return <Badge className="bg-green-500">Autorisé</Badge>;
      case 'denied':
        return <Badge variant="destructive">Refusé</Badge>;
      default:
        return <Badge variant="secondary">En attente</Badge>;
    }
  };

  const getTestBadge = (success: boolean) => {
    return success ? 
      <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Fonctionne</Badge> :
      <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Problème</Badge>;
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Diagnostic des périphériques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={runDiagnostic}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? "Test en cours..." : "Tester les périphériques"}
        </Button>

        {diagnostic && (
          <div className="space-y-3">
            {/* Caméras */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                <span className="font-medium">Caméras ({diagnostic.cameras.length})</span>
                {getTestBadge(diagnostic.testResults.cameraTest)}
              </div>
              <div className="text-sm">
                Permission: {getPermissionBadge(diagnostic.permissions.camera)}
              </div>
              {diagnostic.cameras.length === 0 && (
                <div className="text-sm text-red-400">Aucune caméra détectée</div>
              )}
            </div>

            {/* Microphones */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                <span className="font-medium">Microphones ({diagnostic.microphones.length})</span>
                {getTestBadge(diagnostic.testResults.microphoneTest)}
              </div>
              <div className="text-sm">
                Permission: {getPermissionBadge(diagnostic.permissions.microphone)}
              </div>
              {diagnostic.microphones.length === 0 && (
                <div className="text-sm text-red-400">Aucun microphone détecté</div>
              )}
            </div>

            {/* Conseils */}
            {(!diagnostic.testResults.cameraTest || !diagnostic.testResults.microphoneTest) && (
              <div className="p-3 bg-yellow-900/20 rounded-lg border border-yellow-600/30">
                <div className="text-sm text-yellow-300">
                  <strong>Solutions:</strong>
                  <ul className="mt-1 space-y-1 list-disc list-inside">
                    <li>Cliquez sur l'icône de cadenas dans la barre d'adresse</li>
                    <li>Autorisez l'accès à la caméra et au microphone</li>
                    <li>Actualisez la page après avoir donné les permissions</li>
                    <li>Vérifiez qu'aucune autre application n'utilise ces périphériques</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}