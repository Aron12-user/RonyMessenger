import { useState } from "react";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import { useToast } from "@/hooks/use-toast";

export default function Meetings() {
  const [meetingLink, setMeetingLink] = useState("rony.meet/abc123def456");
  const { toast } = useToast();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingLink);
    toast({
      title: "Link copied",
      description: "Meeting link copied to clipboard",
    });
  };

  return (
    <section className="flex-1 p-6 flex flex-col">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Virtual Meetings</h2>
            <Button className="bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg flex items-center space-x-2">
              <span className="material-icons">add</span>
              <span>New Meeting</span>
            </Button>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-5 border border-gray-200 dark:border-gray-600">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg">Product Review</h3>
                <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Now</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">Weekly review of product development progress and roadmap updates.</p>
              
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                <span className="material-icons text-sm mr-1">schedule</span>
                <span>11:00 AM - 12:00 PM</span>
              </div>
              
              <div className="flex items-center flex-wrap gap-2 mb-4">
                <UserAvatar initials="SA" color="blue" size="sm" />
                <UserAvatar initials="TB" color="green" size="sm" />
                <UserAvatar initials="MM" color="purple" size="sm" />
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center text-gray-800 dark:text-gray-200 text-sm">
                  +3
                </div>
              </div>
              
              <Button className="w-full bg-primary hover:bg-primary-dark text-white py-2 rounded-lg flex items-center justify-center space-x-2">
                <span className="material-icons">videocam</span>
                <span>Join Meeting</span>
              </Button>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-5 border border-gray-200 dark:border-gray-600">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg">Client Presentation</h3>
                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Upcoming</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4">Final presentation of the new website design to the client.</p>
              
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                <span className="material-icons text-sm mr-1">schedule</span>
                <span>3:00 PM - 4:30 PM</span>
              </div>
              
              <div className="flex items-center flex-wrap gap-2 mb-4">
                <UserAvatar initials="JW" color="red" size="sm" />
                <UserAvatar initials="DK" color="yellow" size="sm" />
                <UserAvatar initials="JD" color="primary" size="sm" />
              </div>
              
              <Button variant="outline" className="w-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white py-2 rounded-lg flex items-center justify-center space-x-2">
                <span className="material-icons">calendar_today</span>
                <span>Add to Calendar</span>
              </Button>
            </div>
          </div>
          
          <div className="mt-8 bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
            <h3 className="font-bold text-lg mb-4">Quick Meeting</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">Start an instant meeting and share the link with your team.</p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <input 
                type="text" 
                value={meetingLink} 
                readOnly 
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2" 
              />
              <Button 
                onClick={handleCopyLink}
                variant="outline" 
                className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
              >
                <span className="material-icons">content_copy</span>
                <span>Copy Link</span>
              </Button>
              <Button className="bg-secondary hover:bg-secondary-dark text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2">
                <span className="material-icons">videocam</span>
                <span>Start</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
