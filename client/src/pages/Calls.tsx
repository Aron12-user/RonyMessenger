import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";

export default function Calls() {
  return (
    <section className="flex-1 p-6 flex flex-col">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1">
        <div className="text-center max-w-md mx-auto">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-icons text-4xl text-primary">call</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Voice & Video Calls</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">Connect with your team through high-quality voice and video calls</p>
          <div className="grid grid-cols-2 gap-4">
            <Button className="bg-primary hover:bg-primary-dark text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2">
              <span className="material-icons">call</span>
              <span>Start Voice Call</span>
            </Button>
            <Button className="bg-secondary hover:bg-secondary-dark text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2">
              <span className="material-icons">videocam</span>
              <span>Start Video Call</span>
            </Button>
          </div>
          
          <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="font-medium mb-4 text-gray-700 dark:text-gray-300">Recent Calls</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <UserAvatar initials="TB" color="green" />
                  <div className="ml-3">
                    <p className="font-medium">Team Brainstorm</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Today, 9:30 AM • 45 min</p>
                  </div>
                </div>
                <span className="material-icons text-green-500">call_made</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <UserAvatar initials="SA" color="blue" />
                  <div className="ml-3">
                    <p className="font-medium">Sarah Anderson</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Yesterday, 2:15 PM • 12 min</p>
                  </div>
                </div>
                <span className="material-icons text-red-500">call_received</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
