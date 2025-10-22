import { Link, useLocation } from 'wouter';
import { Menu, Bell, User, Briefcase, MessageSquare, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/lib/auth-context';

export function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/">
            <a className="flex items-center gap-2 hover-elevate rounded-md px-2 py-1" data-testid="link-home">
              <Briefcase className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">JobTradeSasa</span>
            </a>
          </Link>

          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1">
              <Link href="/jobs">
                <a>
                  <Button variant="ghost" data-testid="link-jobs">
                    Browse Jobs
                  </Button>
                </a>
              </Link>
              {user?.role === 'provider' && (
                <Link href="/dashboard">
                  <a>
                    <Button variant="ghost" data-testid="link-dashboard">
                      <LayoutDashboard className="h-4 w-4 mr-2" />
                      Dashboard
                    </Button>
                  </a>
                </Link>
              )}
              {user?.role === 'admin' && (
                <Link href="/admin">
                  <a>
                    <Button variant="ghost" data-testid="link-admin">
                      <LayoutDashboard className="h-4 w-4 mr-2" />
                      Admin Panel
                    </Button>
                  </a>
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {isAuthenticated ? (
            <>
              {user?.role === 'requester' && (
                <Link href="/post-job">
                  <a>
                    <Button className="hidden sm:flex" data-testid="button-post-job">
                      Post a Job
                    </Button>
                  </a>
                </Link>
              )}

              <Button variant="ghost" size="icon" data-testid="button-notifications">
                <Bell className="h-5 w-5" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-user-menu">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user?.profilePhotoUrl || undefined} alt={user?.name} />
                      <AvatarFallback>{user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {user?.isVerified && (
                      <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-primary" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium leading-none">{user?.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                      <Badge variant="outline" className="w-fit mt-1 capitalize">
                        {user?.role}
                      </Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation('/profile')} data-testid="menu-profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation('/messages')} data-testid="menu-messages">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Messages
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} data-testid="menu-logout">
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <a>
                  <Button variant="ghost" data-testid="button-login">
                    Login
                  </Button>
                </a>
              </Link>
              <Link href="/signup">
                <a>
                  <Button data-testid="button-signup">Get Started</Button>
                </a>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
