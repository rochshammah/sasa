import { z } from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MapPin, Upload, AlertCircle, Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { insertJobSchema, type Category } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { z } from 'zod';

// Extend the schema to include custom category
const extendedJobSchema = insertJobSchema.extend({
  customCategory: z.string().optional(),
});

export default function PostJob() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const form = useForm({
    resolver: zodResolver(extendedJobSchema),
    defaultValues: {
      title: '',
      description: '',
      categoryId: undefined as unknown as number,
      customCategory: '',
      latitude: '',
      longitude: '',
      address: '',
      urgency: 'normal' as const,
      preferredTime: undefined,
      photos: [],
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      // Prepare the job data
      const jobData = { 
        title: data.title,
        description: data.description,
        categoryId: data.categoryId,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        urgency: data.urgency,
        preferredTime: data.preferredTime,
        photos: data.photos,
      };

      // If using custom category, send both categoryId and customCategory
      if (data.categoryId === -1 && data.customCategory) {
        jobData.categoryId = -1; // Keep -1 to indicate custom category
      }

      const res = await apiRequest('POST', '/api/jobs', jobData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: 'Job posted successfully!',
        description: 'Service providers near you will be notified.',
      });
      setLocation('/my-jobs');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to post job',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocationCoords({ lat: latitude, lng: longitude });
          form.setValue('latitude', latitude.toString());
          form.setValue('longitude', longitude.toString());
          
          // Reverse geocode to get address
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then((res) => res.json())
            .then((data) => {
              if (data.display_name) {
                form.setValue('address', data.display_name);
              }
            });
        },
        (error) => {
          toast({
            title: 'Location error',
            description: 'Unable to get your location. Please enter it manually.',
            variant: 'destructive',
          });
        }
      );
    }
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    
    if (value === 'other') {
      form.setValue('categoryId', -1); // Use -1 to indicate custom category
    } else {
      form.setValue('categoryId', parseInt(value));
      form.setValue('customCategory', '');
    }
  };

  const onSubmit = (data: any) => {
    mutation.mutate(data);
  };

  const showCustomCategory = selectedCategory === 'other';

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Post a Service Request</CardTitle>
          <CardDescription>
            Describe what you need and connect with qualified service providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Fix leaking kitchen sink"
                        data-testid="input-job-title"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A clear, concise title helps providers understand your needs
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Provide detailed information about the work needed..."
                        className="min-h-32"
                        data-testid="input-job-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={handleCategoryChange}
                    value={selectedCategory}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-job-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>

                {showCustomCategory && (
                  <FormField
                    control={form.control}
                    name="customCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specify Category</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your specific category (e.g., Furniture Assembly, Pet Sitting)"
                            data-testid="input-custom-category"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Please specify the type of service you need
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="space-y-4">
                <FormLabel>Location</FormLabel>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={getCurrentLocation}
                    className="flex-1"
                    data-testid="button-current-location"
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    Use Current Location
                  </Button>
                </div>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Enter address or location"
                          data-testid="input-job-address"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Hidden fields for coordinates */}
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem className="hidden">
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem className="hidden">
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="urgency"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-warning" />
                        Emergency Request
                      </FormLabel>
                      <FormDescription>
                        Mark as emergency for urgent attention
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value === 'emergency'}
                        onCheckedChange={(checked) =>
                          field.onChange(checked ? 'emergency' : 'normal')
                        }
                        data-testid="switch-emergency"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preferredTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Time (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        data-testid="input-preferred-time"
                        {...field}
                        value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ''}
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setLocation('/jobs')}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={mutation.isPending}
                  data-testid="button-submit-job"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    'Post Job'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
