import { Link, useLocation } from 'wouter';
import { Home, Briefcase, MessageSquare, User } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function MobileNav() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  const navItems = [
    { href: '/jobs', icon: Home, label: 'Home', testId: 'nav-home' },
    { href: '/my-jobs', icon: Briefcase, label: 'Jobs', testId: 'nav-jobs' },
    { href: '/messages', icon: MessageSquare, label: 'Messages', testId: 'nav-messages' },
    { href: '/profile', icon: User, label: 'Profile', testId: 'nav-profile' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <a
                className={`flex flex-col items-center justify-center flex-1 h-full gap-1 hover-elevate transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
                data-testid={item.testId}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
