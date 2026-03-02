import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Github, Shield } from "lucide-react";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

const AuthModal = ({ open, onClose }: AuthModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-foreground">Sign in to continue</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Connect your GitHub account to access AI-powered issue analysis and insights.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <Button variant="github" className="w-full" asChild>
            <a href="/auth/github">
              <Github className="h-4 w-4" />
              Sign in with GitHub
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
