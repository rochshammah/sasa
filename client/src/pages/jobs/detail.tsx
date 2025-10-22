import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { MapPin, Calendar, AlertCircle, MessageSquare, Star, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Job } from '@shared/schema';

export default function JobDetail() {
  const [, params] = useRoute('/jobs/:id');
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: job, isLoading } = useQuery<Job & { requester: any; provider: any; category: any }>({
    queryKey: ['/api/jobs', params?.id],
    enabled: !!params?.id,
  });

  const acceptJobMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/jobs/${params?.id}/accept`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', params?.id] });
      toast({
        title: 'Job accepted!',
        description: 'You can now start working on this job.',
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest('PATCH', `/api/jobs/${params?.id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', params?.id] });
      toast({
        title: 'Status updated',
        description: 'Job status has been updated successfully.',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full mb-4" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Job not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isRequester = user?.id === job.requesterId;
  const isProvider = user?.role === 'provider';
  const isAssignedProvider = user?.id === job.providerId;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Job Header */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={job.urgency === 'emergency' ? 'destructive' : 'secondary'}>
                    {job.urgency === 'emergency' ? 'Emergency' : 'Normal'}
                  </Badge>
                  <Badge variant="outline">{job.category?.name}</Badge>
                  <Badge variant={job.status === 'open' ? 'default' : 'secondary'}>
                    {job.status}
                  </Badge>
                </div>
                <CardTitle className="text-3xl mb-2">{job.title}</CardTitle>
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {job.address || 'Location not specified'}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Posted {new Date(job.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              {isProvider && job.status === 'open' && !isAssignedProvider && (
                <Button
                  onClick={() => acceptJobMutation.mutate()}
                  disabled={acceptJobMutation.isPending}
                  data-testid="button-accept-job"
                >
                  Accept Job
                </Button>
              )}
              {isAssignedProvider && (
                <Button
                  onClick={() => setLocation(`/messages/${job.id}`)}
                  data-testid="button-message-requester"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Message Requester
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground leading-relaxed">{job.description}</p>
              </div>

              {job.preferredTime && (
                <div>
                  <h3 className="font-semibold mb-2">Preferred Time</h3>
                  <p className="text-muted-foreground">
                    {new Date(job.preferredTime).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Requester Info */}
        <Card>
          <CardHeader>
            <CardTitle>Posted By</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={job.requester?.profilePhotoUrl} />
                <AvatarFallback>{job.requester?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{job.requester?.name}</p>
                <p className="text-sm text-muted-foreground">{job.requester?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provider Info */}
        {job.provider && (
          <Card>
            <CardHeader>
              <CardTitle>Assigned Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={job.provider?.profilePhotoUrl} />
                  <AvatarFallback>{job.provider?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{job.provider?.name}</p>
                    {job.provider?.isVerified && (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{job.provider?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Actions */}
        {isAssignedProvider && (
          <Card>
            <CardHeader>
              <CardTitle>Update Job Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {job.status === 'accepted' && (
                  <Button
                    onClick={() => updateStatusMutation.mutate('enroute')}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-status-enroute"
                  >
                    En Route
                  </Button>
                )}
                {job.status === 'enroute' && (
                  <Button
                    onClick={() => updateStatusMutation.mutate('onsite')}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-status-onsite"
                  >
                    On Site
                  </Button>
                )}
                {job.status === 'onsite' && (
                  <Button
                    onClick={() => updateStatusMutation.mutate('completed')}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-status-complete"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Mark as Complete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
