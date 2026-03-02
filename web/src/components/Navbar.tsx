import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Github, User, Search, Command } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavbarProps {
  isAuthenticated?: boolean;
}

const Navbar = ({ isAuthenticated = false }: NavbarProps) => {
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 glass">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Left: Logo */}
        <Link to="/" className="flex items-center gap-2 font-mono font-semibold text-foreground hover:text-primary transition-colors">
          <span className="text-primary font-bold text-lg">&gt;_</span>
          <span className="text-base tracking-tight">Sentinel-OSS</span>
        </Link>

        {/* Center: Search hint */}
        {/* <button
          onClick={() => navigate("/")}
          className="hidden md:flex items-center gap-2 rounded-lg glass-input px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/30 transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="font-mono text-xs">Search repositories...</span>
          <kbd className="ml-4 flex items-center gap-0.5 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button> */}

        {/* Right: Auth */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 glass-card border-border/50">
                <DropdownMenuItem onClick={() => navigate("/settings")} className="text-foreground focus:bg-secondary font-mono text-xs">
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="github" size="sm" asChild className="font-mono text-xs">
              <a href="/auth/github">
                <Github className="h-4 w-4" />
                Sign in
              </a>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
