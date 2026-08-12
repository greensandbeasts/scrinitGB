import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ContentPolicyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContentPolicyModal({ open, onOpenChange }: ContentPolicyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Scrinit Content Policy</DialogTitle>
          <DialogDescription>
            The policy should clearly explain what content is prohibited from being submitted to Scrinit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Screenplays may contain mature fictional subject matter such as:</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Violence.</li>
              <li>Crime.</li>
              <li>Murder.</li>
              <li>Abuse.</li>
              <li>Strong language.</li>
              <li>Sexual themes.</li>
              <li>Discrimination.</li>
              <li>Racism as part of characterisation or story.</li>
              <li>Drug use.</li>
              <li>Horror.</li>
              <li>Disturbing or controversial themes.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-medium">However, screenplays must not contain prohibited material, including:</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>
                Pornographic material whose primary purpose is sexual gratification.
              </li>
              <li>Sexual content involving minors.</li>
              <li>Sexual exploitation or sexualisation of minors.</li>
              <li>Content that facilitates real-world criminal activity or violence.</li>
              <li>Material primarily intended to promote hatred against protected groups.</li>
              <li>Content promoting or recruiting for terrorist or extremist organisations.</li>
              <li>Other material that Scrinit is legally or operationally prohibited from hosting.</li>
            </ul>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              The policy should make clear that fictional depiction of difficult subject matter is not automatically prohibited simply because the subject matter is disturbing, offensive or mature.
            </p>
          </div>
        </div>
        <DialogContent className="space-y-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogContent>
      </DialogContent>
    </Dialog>
  );
}