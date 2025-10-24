import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Filter, SlidersHorizontal, Star, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import type { Job, Category } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

export default function BrowseJobs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');

  const { data: jobs, isLoading: jobsLoading } = useQuery<(Job & { requester: any; category: Category })[]>({
    queryKey: ['jobs', { category: selectedCategory, sort: sortBy }],
    queryFn: async () => {
      let url = '/api/jobs';
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      params.append('sort', sortBy);
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      const response = await apiRequest('GET', url);
      return response.json();
    },
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
  });

  const filteredJobs = jobs?.filter((job) =>
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Browse Jobs</h1>
        <p className="text-muted-foreground">Find service requests near you</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-jobs"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger data-testid="select-sort">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="urgent">Urgent First</SelectItem>
                <SelectItem value="distance">Nearest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Grid */}
      {jobsLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3 mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredJobs && filteredJobs.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <a>
                <Card className="hover-elevate active-elevate-2 transition-all h-full" data-testid={`card-job-${job.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant={job.urgency === 'emergency' ? 'destructive' : 'secondary'}>
                        {job.urgency === 'emergency' ? 'Emergency' : 'Normal'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 line-clamp-2">{job.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {job.description}
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground truncate">{job.address || 'Location not specified'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {job.category?.name || 'Uncategorized'}
                        </Badge>
                        {job.status === 'open' ? (
                          <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Open
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {job.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </a>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-muted p-4">
                <Filter className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">No jobs found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters or search query
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
