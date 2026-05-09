import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { TosContent } from './TosContent';
import { PrivacyContent } from './PrivacyContent';

interface LegalModalProps {
  type: 'tos' | 'privacy' | null;
  onClose: () => void;
}

export function LegalModal({ type, onClose }: LegalModalProps) {
  return (
    <Dialog open={type !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">
          {type === 'tos' ? 'Terms of Service' : 'Privacy Policy'}
        </DialogTitle>
        <ScrollArea className="max-h-[75vh] px-8 pt-8 pb-2">
          {type === 'tos' && <TosContent />}
          {type === 'privacy' && <PrivacyContent />}
        </ScrollArea>
        <DialogFooter className="px-8 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
