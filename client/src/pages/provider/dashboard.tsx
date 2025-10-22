import { useQuery } from '@tanstack/react-query';
import { TrendingUp, DollarSign, Clock, Star, Briefcase, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { Link } from 'wouter';

export default function ProviderDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/provider/stats'],
  });

  const { data: recentJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/provider/recent-jobs'],
  });

  const statCards = [
    {
      title: 'Total Earnings',
      value: `$${stats?.totalEarnings || 0}`,
      icon: DollarSign,
      description: 'This month',
      color: 'text-success',
    },
    {
      title: 'Jobs Completed',
      value: stats?.completedJobs || 0,
      icon: CheckCircle2,
      description: 'All time',
      color: 'text-primary',
    },
    {
      title: 'Average Rating',
      value: stats?.averageRating || 0,
      icon: Star,
      description: 'From clients',
      color: 'text-warning',
    },
    {
      title: 'Response Time',
      value: `${stats?.avgResponseTime || 0}m`,
      icon: Clock,
      description: 'Average',
      color: 'text-muted-foreground',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsLoading ? (
          [1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
          <CardDescription>Your latest job assignments</CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : recentJobs && recentJobs.length > 0 ? (
            <div className="space-y-4">
              {recentJobs.map((job: any) => (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <a>
                    <div className="flex items-center gap-4 p-4 border rounded-lg hover-elevate active-elevate-2 transition-all">
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{job.title}</h3>
                        <p className="text-sm text-muted-foreground">{job.requester?.name}</p>
                      </div>
                      <Badge variant={job.status === 'completed' ? 'secondary' : 'default'}>
                        {job.status}
                      </Badge>
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No recent jobs</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
