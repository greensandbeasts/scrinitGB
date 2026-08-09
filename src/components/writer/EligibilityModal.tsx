import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { ContentPolicyModal } from "./ContentPolicyModal";

interface EligibilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EligibilityModal = ({ open, onOpenChange }: EligibilityModalProps) => {
  const [showContentPolicy, setShowContentPolicy] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Screenplay Eligibility</DialogTitle>
            <DialogDescription>
              Scrinit is for completed screenplays ready for meaningful feedback.
            </DialogDescription>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto pr-6">
            <p>Please upload your screenplay only if it:</p>
            <ul>
              <li>Is complete.</li>
              <li>Is properly formatted.</li>
              <li>Is readable from beginning to end.</li>
              <li>Represents your current best draft.</li>
              <li>Is ready to receive constructive feedback from other writers.</li>
              <li>Has a first page containing only the screenplay title.</li>
              <li>Contains no identifying information on the first page.</li>
            </ul>

            <h3>Title Page Requirement</h3>
            <p>The first page of every screenplay must contain <strong>only the title of the screenplay</strong>.</p>
            <p>The title on the first page must match the title entered in the metadata. The first page must not contain:</p>
            <ul>
              <li>Writer name.</li>
              <li>Contact details (email, phone, website, social media).</li>
              <li>Production company, agent, or manager details.</li>
              <li>Copyright information.</li>
              <li>Any other identifying information.</li>
            </ul>
            <p>Scrinit only performs the mandatory anonymity check on the <strong>first page</strong>.</p>

            <h3>The following should not be uploaded:</h3>
            <ul>
              <li>Incomplete screenplays, scene collections, notes, outlines, or treatments.</li>
              <li>Exploratory first drafts.</li>
              <li>Produced screenplays or those in active professional development.</li>
            </ul>
            <p>If you revise your screenplay, upload the new draft as a new version of the existing screenplay.</p>

            <h3>Content Policy</h3>
            <p>
              Scrinit has a <strong>Content Policy</strong> governing what may be submitted.
              <Button variant="link" className="p-0 h-auto ml-1" onClick={() => setShowContentPolicy(true)}>
                View Content Policy
              </Button>
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ContentPolicyModal open={showContentPolicy} onOpenChange={setShowContentPolicy} />
    </>
  );
};