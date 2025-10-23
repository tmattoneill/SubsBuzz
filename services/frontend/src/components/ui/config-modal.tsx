import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";
import { MonitoredEmail, UserSettings } from "@/lib/types";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const emailSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  monitoredEmails: MonitoredEmail[];
  userSettings: UserSettings;
  onAddEmail: (email: string) => void;
  onRemoveEmail: (id: number) => void;
  onUpdateSettings: (settings: Partial<UserSettings>) => void;
}

export function ConfigModal({
  isOpen,
  onClose,
  monitoredEmails,
  userSettings,
  onAddEmail,
  onRemoveEmail,
  onUpdateSettings
}: ConfigModalProps) {
  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (data: z.infer<typeof emailSchema>) => {
    onAddEmail(data.email);
    form.reset();
  };

  const handleSettingChange = (setting: keyof UserSettings, value: boolean) => {
    onUpdateSettings({ [setting]: value });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-gray-800 rounded-xl shadow-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">Configure Monitored Addresses</DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Add email addresses to monitor for digest generation and configure your notification preferences.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mb-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">Add New Email Address</FormLabel>
                    <div className="flex">
                      <FormControl>
                        <Input 
                          placeholder="Enter email address" 
                          {...field} 
                          className="rounded-r-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                      </FormControl>
                      <Button 
                        type="submit" 
                        className="bg-primary text-white rounded-l-none hover:bg-blue-600 transition"
                      >
                        Add
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
          
          <div>
            <h3 className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Currently Monitored</h3>
            {monitoredEmails.length > 0 ? (
              <ul className="space-y-3">
                {monitoredEmails.map(email => (
                  <li key={email.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="dark:text-white">{email.email}</span>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      onClick={() => onRemoveEmail(email.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm italic">No email addresses monitored yet.</p>
            )}
          </div>
          
          <div className="mt-6">
            <h3 className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Advanced Settings</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium dark:text-white">Daily Digests</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Generate digests once per day</p>
                </div>
                <Switch 
                  checked={userSettings.dailyDigestEnabled} 
                  onCheckedChange={(checked) => handleSettingChange('dailyDigestEnabled', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium dark:text-white">Topic Clustering</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Group emails by similar topics</p>
                </div>
                <Switch 
                  checked={userSettings.topicClusteringEnabled}
                  onCheckedChange={(checked) => handleSettingChange('topicClusteringEnabled', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium dark:text-white">Email Notifications</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when digest is ready</p>
                </div>
                <Switch 
                  checked={userSettings.emailNotificationsEnabled}
                  onCheckedChange={(checked) => handleSettingChange('emailNotificationsEnabled', checked)}
                />
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="border-t dark:border-gray-700 pt-4 flex justify-end space-x-3">
          <Button 
            variant="outline"
            onClick={onClose}
            className="dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button 
            onClick={onClose}
            className="bg-primary text-white hover:bg-blue-600 transition"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
