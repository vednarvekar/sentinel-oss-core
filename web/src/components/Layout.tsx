import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

interface LayoutProps {
  children?: React.ReactNode;
  isAuthenticated?: boolean;
}

const Layout = ({ children, isAuthenticated = false }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar isAuthenticated={isAuthenticated} />
      <main>{children}</main>
    </div>
  );
};

export default Layout;
