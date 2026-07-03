## Vibe
- Swiss Modernism × Logistics Operations: Mathematical grid discipline meets functional clarity from UN/humanitarian logistics environments. Strict typographic hierarchy, traffic-light status system, and systematic whitespace rhythm.

## Color
- Primary: #2563EB
- On Primary: #FFFFFF
- Accent: #EA580C
- On Accent: #FFFFFF
- Background: #F8FAFC
- Foreground: #1E293B
- Muted: #E9EFF8
- Border: #CBD5E1
- Secondary: #3B82F6

## Typography
- Heading: HarmonyOS Sans (family: HarmonyOSSans, weight: Bold, url: https://resource-static.bj.bcebos.com/fonts-skill/HarmonyOSSans_Bold.ttf)
- Body: HarmonyOS Sans (family: HarmonyOSSans, weight: Regular, url: https://resource-static.bj.bcebos.com/fonts-skill/HarmonyOSSans_Regular.ttf)

## Visual Language
- Core visual signature: Strict left-aligned typographic hierarchy using systematic scale ratios — section labels in SemiBold uppercase tracking, data values in large Regular weight, creating immediate visual parsing without color decoration
- Material & depth: Single-level elevation using subtle border (#CBD5E1) on white cards against light grey (#F8FAFC) page background; no gradients; active states use Primary fill; success/warning/danger badge fills for status
- Containers & buttons: Cards with 1px border, 8px radius, white background; primary actions use solid Primary fill; secondary use Muted background + Foreground text; status badges use traffic-light system (green approved, amber pending, red rejected, blue submitted, grey draft)
- Layout rhythm: Sidebar nav at fixed width; content area grid; Primary color appears only on CTAs, active nav items, and key data highlights; large whitespace margins between sections

## Animation
- Entrance: Cards fade-in with 150ms ease-out on page load
- Interaction: Button press subtle scale-down 0.97 at 100ms; status badge color transition 200ms
- Scroll / transition: Page route transitions with 200ms fade

## Forbidden
- No gradient backgrounds or large Primary/Accent color fills in hero or content zones
- No decorative rounded cards as the sole visual signature — depth comes from border + background contrast
- No emoji in navigation, headers, or status indicators

## Additional Notes
- All user-visible copy in English
- Login page: split-screen layout — left panel with brand identity (dark blue with system name and tagline), right panel with login form on white
- Status badge system: Finalised=green, Approved=green, Submitted=blue, In Progress=amber, Rejected=red, Draft=grey
- Map component uses Leaflet with OpenStreetMap tiles
- Signature pads use HTML5 Canvas with react-signature-canvas library
