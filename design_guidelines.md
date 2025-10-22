# JobTradeSasa Design Guidelines

## Design Approach

**Selected Approach:** Design System (Material Design 3) with Service Marketplace Patterns

**Justification:** JobTradeSasa is a utility-focused, location-based service marketplace requiring efficiency, trust-building, and real-time interaction patterns. Material Design 3 provides robust mobile-first components ideal for PWAs, with strong support for dynamic color theming, geolocation interfaces, and real-time feedback.

**Reference Inspirations:**
- Uber/Lyft: Location-based matching, real-time status updates, map integration
- TaskRabbit/Thumbtack: Service provider profiles, job posting flows, trust signals
- WhatsApp Business: Chat interface patterns, status indicators, media sharing

**Key Design Principles:**
1. **Trust First:** Clear provider verification badges, prominent ratings, transparent pricing
2. **Location Clarity:** Map-centric job discovery with clear distance/availability indicators  
3. **Status Transparency:** Real-time job status progression with clear visual feedback
4. **Efficient Actions:** One-tap primary actions, minimal steps to core tasks

## Core Design Elements

### A. Color Palette

**Dark Mode (Primary):**
- Background: 220 15% 8%
- Surface: 220 12% 12%
- Surface Elevated: 220 10% 16%
- Primary: 210 100% 60% (Trust blue for CTAs, verification badges)
- Primary Variant: 210 100% 50%
- Secondary: 160 60% 45% (Success green for completed jobs, availability)
- Accent: 30 95% 55% (Urgent/emergency indicators - use sparingly)
- Text Primary: 0 0% 95%
- Text Secondary: 0 0% 70%
- Border: 220 10% 24%

**Light Mode:**
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Surface Elevated: 220 20% 97%
- Primary: 210 100% 45%
- Secondary: 160 60% 40%
- Accent: 30 95% 50%
- Text Primary: 220 20% 15%
- Text Secondary: 220 10% 45%

### B. Typography

**Font Families:**
- Primary: 'Inter' (Google Fonts) - UI elements, body text, forms
- Display: 'Inter' at larger weights (600-700) - Headers, hero sections

**Scale:**
- Hero/Display: text-4xl to text-5xl (mobile) / text-6xl to text-7xl (desktop), font-bold
- Section Headers: text-2xl to text-3xl, font-semibold
- Card Titles: text-lg to text-xl, font-semibold
- Body Text: text-base (16px), font-normal, leading-relaxed
- Captions/Metadata: text-sm, font-medium
- Micro-labels: text-xs

### C. Layout System

**Spacing Primitives:** Use Tailwind units of 2, 3, 4, 6, 8, 12, 16 for consistency
- Component padding: p-4 (mobile), p-6 to p-8 (desktop)
- Section spacing: space-y-6 to space-y-8
- Card gaps: gap-4 to gap-6
- Button padding: px-6 py-3

**Grid System:**
- Job listings: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Provider cards: Masonry-style or uniform grid depending on content
- Dashboard metrics: grid-cols-2 md:grid-cols-4 gap-4

**Container Widths:**
- Full-width maps and hero: w-full
- Content sections: max-w-7xl mx-auto
- Forms and chat: max-w-3xl mx-auto

### D. Component Library

**Navigation:**
- Top navbar with role-specific actions (Create Job / Toggle Availability)
- Bottom tab bar for mobile (Home, Jobs, Messages, Profile)
- Provider/Requester mode switcher for dual-role users
- Location indicator in header with city/distance

**Job Cards:**
- Elevated card with subtle shadow (shadow-md)
- Top section: Category icon + Urgency badge (if emergency)
- Job title (font-semibold), truncated description
- Location with distance indicator + timestamp
- Bottom: Provider avatar + rating (if matched) OR "X providers nearby"
- Status indicator (color-coded chip: open/in-progress/completed)

**Provider Cards:**
- Horizontal layout on mobile, can be vertical grid on desktop
- Large avatar with verification badge overlay
- Name, rating stars (filled/outline), review count
- Service categories as chips
- Distance indicator, availability status (green dot = online)
- Response time and completed jobs count
- "View Profile" secondary button

**Map Interface:**
- Full-screen map view option with job/provider markers
- Custom markers: Different colors for job urgency, provider availability
- Info window on marker click with quick actions
- Map controls: Zoom, current location, layer toggle
- Floating search bar overlay on map

**Chat Interface:**
- WhatsApp-inspired message bubbles (rounded-2xl)
- Sender messages: align-right, primary color background
- Received: align-left, surface elevated background
- Message timestamps (text-xs, muted)
- Image thumbnails in grid, expandable lightbox
- Typing indicator with animated dots
- Voice note player (if implemented later)
- Quick actions: Camera, gallery, location share

**Forms:**
- Consistent input styling: rounded-lg, border-2, focus:ring effect
- Floating labels or clear top-aligned labels
- Category selector: Icon grid or searchable dropdown
- Location picker: Map modal + address autocomplete
- Photo upload: Drag-drop zone + gallery grid preview
- Budget input: Currency prefix, number validation
- Urgency toggle: Prominent switch with emergency icon

**Status Progression:**
- Horizontal stepper for job lifecycle (Open → Accepted → En Route → On Site → Completed)
- Active step highlighted in primary color, completed in secondary
- Icons for each stage with connecting lines

**Rating Component:**
- Large star icons (5 stars), touch-friendly sizing
- Hover/selected states with smooth transitions
- Comment textarea below stars
- Submit button only active when rating selected

**Analytics Dashboard (Provider):**
- KPI cards in grid: Jobs completed, total earnings, avg response time, rating
- Line chart for earnings over time
- Bar chart for jobs by category
- Clean, minimal chart styling with Material Design colors

**Data Displays:**
- List items: py-4, border-b divider
- Tables (admin): Striped rows, sticky header, sortable columns
- Empty states: Centered icon + message + CTA
- Loading states: Skeleton screens matching content layout

**Overlays:**
- Modals: max-w-2xl, rounded-xl, centered with backdrop blur
- Bottom sheets (mobile): Slide up from bottom, rounded-t-3xl
- Alerts/Toasts: Top-right position, auto-dismiss, icon + message
- Confirmation dialogs: Centered, clear primary/secondary actions

### E. Animations

**Minimal, purposeful animations only:**
- Page transitions: Subtle fade (200ms)
- Button press: scale-95 on active
- Modal entry: Fade + slide-up (300ms)
- Status changes: Color transition (200ms)
- Loading spinners: Smooth rotation only where necessary
- Chat message entry: Slide-in from sender side (150ms)

## Images

**Hero Section (Landing/Marketing):**
Large hero image showing service providers at work (plumber, electrician, carpenter in action). Overlay with semi-transparent dark gradient for text readability. Image should convey professionalism and local community feel.

**Provider Profiles:**
Profile photos (square or circular avatars), portfolio images in masonry grid showing completed work examples.

**Job Listings:**
Optional job photos uploaded by requesters, displayed as thumbnails in card top section.

**Empty States:**
Illustrative graphics (line art style) for "no jobs nearby," "no messages," etc.

**Trust Badges:**
Small icons for verification status, featured provider badges, emergency availability.