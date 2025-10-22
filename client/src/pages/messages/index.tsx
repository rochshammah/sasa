import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth-context';

export default function Messages() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['/api/messages/conversations'],
  });

  const filteredConversations = conversations?.filter((conv: any) =>
    conv.otherUser?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Messages</h1>
        <p className="text-muted-foreground">Your conversations</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-messages"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-4 w-12" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredConversations && filteredConversations.length > 0 ? (
          filteredConversations.map((conv: any) => (
            <Link key={conv.jobId} href={`/messages/${conv.jobId}`}>
              <a>
                <Card className="hover-elevate active-elevate-2 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={conv.otherUser?.profilePhotoUrl} />
                        <AvatarFallback>{conv.otherUser?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{conv.otherUser?.name}</h3>
                          {conv.unreadCount > 0 && (
                            <Badge variant="destructive" className="h-5 px-2">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                        <p className="text-xs text-muted-foreground mt-1">{conv.jobTitle}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(conv.lastMessageTime).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </a>
            </Link>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No conversations yet</h3>
              <p className="text-muted-foreground">
                Start a conversation by accepting a job or posting a request
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
