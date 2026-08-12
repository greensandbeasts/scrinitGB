import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface EligibilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EligibilityModal({ open, onOpenChange }: EligibilityModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button className="link">Is my screenplay eligible?</button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Screenplay Eligibility</DialogTitle>
          <DialogDescription>
            Scrinit is designed for completed screenplays that are ready for meaningful community feedback.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Please upload your screenplay only if it:</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Is complete.</li>
              <li>Is properly formatted.</li>
              <li>Is readable from beginning to end.</li>
              <li>Represents your current best draft.</li>
              <li>Is ready to receive constructive feedback from other writers.</li>
              <li>Has a first page containing only the screenplay title.</li>
              <li>Contains no identifying information on the first page.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-medium">Title Page Requirement</h3>
            <p className="text-sm text-muted-foreground">
              The first page of every screenplay must contain <strong className="font-semibold">only the title of the screenplay</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              The title on the first page must match the title entered in the metadata.
            </p>
            <p className="text-sm text-muted-foreground">
              The first page must not contain:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li>Writer name.</li>
              <li>Contact details.</li>
              <li>Email address.</li>
              <li>Phone number.</li>
              <li>Website.</li>
              <li>Social media handle.</li>
              <li>Production company.</li>
              <li>Agent or manager details.</li>
              <li>Copyright information.</li>
              <li>Address.</li>
              <li>Any other identifying information.</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              The screenplay itself may naturally contain character names, fictional contact details and other story content.
            </p>
            <p className="text-sm text-muted-foreground">
              Scrinit only performs the mandatory anonymity check on the <strong className="font-semibold">first page</strong>.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-medium">The following should not be uploaded:</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Incomplete screenplays.</li>
              <li>Scene collections.</li>
              <li>Story notes.</li>
              <li>Outlines.</li>
              <li>Treatments.</li>
              <li>Exploratory first drafts.</li>
              <li>Produced screenplays.</li>
              <li>Screenplays already in active professional development.</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              If you revise your screenplay after receiving feedback, upload the new draft as a new version of the existing screenplay rather than creating a separate project.
            </p>
          </div>
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium">Content Policy</h3>
            <p className="text-sm text-muted-foreground">
              Scrinit has a <strong className="font-semibold">Content Policy</strong> governing what may be submitted to the platform.
            </p>
            <button
              className="text-sm font-medium text-primary-foreground hover:underline"
              onClick={() => {
                // We'll open the Content Policy modal from here
                // We need to pass a callback to open the content policy modal
                // For now, we'll just alert
                alert("Content Policy modal would open here");
              }}
            >
              View Content Policy
            </button>
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