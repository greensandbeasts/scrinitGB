import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";

interface ContentPolicyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContentPolicyModal = ({ open, onOpenChange }: ContentPolicyModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scrinit Content Policy</DialogTitle>
          <DialogDescription>
            The following content is prohibited from being submitted to Scrinit.
          </DialogDescription>
        </DialogHeader>
        <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto pr-6">
          <p>
            Scrinit is a platform for writers to share their work and receive feedback. While we encourage creative freedom, we must also ensure a safe and legal environment for all users.
          </p>
          <h4>Permitted Mature Themes</h4>
          <p>
            Screenplays are a medium for exploring the human condition, which often involves difficult or mature subject matter. Fictional depictions of such themes are generally permitted. This includes, but is not limited to:
          </p>
          <ul>
            <li>Violence, crime, and murder</li>
            <li>Abuse and its consequences</li>
            <li>Strong language and profanity</li>
            <li>Sexual themes and situations</li>
            <li>Discrimination and racism as part of characterization or story</li>
            <li>Drug use and addiction</li>
            <li>Horror and disturbing imagery</li>
            <li>Controversial social or political themes</li>
          </ul>
          <p>
            The presence of mature themes is not, in itself, a violation of this policy. We distinguish between the fictional exploration of a topic and content that is prohibited.
          </p>
          <h4>Prohibited Content</h4>
          <p>
            The following material is strictly prohibited and will be removed. Submission of such content may result in account termination.
          </p>
          <ul>
            <li><strong>Pornographic Material:</strong> Content whose primary purpose is sexual gratification, rather than storytelling.</li>
            <li><strong>Sexual Content Involving Minors:</strong> Any depiction of sexual activity, exploitation, or sexualization of individuals under the age of 18 is strictly forbidden.</li>
            <li><strong>Real-World Harm:</strong> Content that facilitates, incites, or promotes real-world criminal activity, violence, or self-harm.</li>
            <li><strong>Hate Speech:</strong> Material primarily intended to promote hatred, discrimination, or violence against individuals or groups based on race, ethnicity, religion, gender, sexual orientation, disability, or other protected characteristics.</li>
            <li><strong>Terrorism and Extremism:</strong> Content that promotes, glorifies, or recruits for terrorist or violent extremist organizations.</li>
            <li><strong>Illegal Content:</strong> Any other material that Scrinit is legally or operationally prohibited from hosting.</li>
          </ul>
          <p>
            This policy is not exhaustive. Scrinit reserves the right to remove any content it deems inappropriate or harmful to the community.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};