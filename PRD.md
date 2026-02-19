# Planning Guide

A comprehensive fairness verification infrastructure for casino gaming platforms (Stake and Roobet) that cryptographically verifies game outcomes for Mines, Keno, and Crash games using provably fair algorithms.

**Experience Qualities**:
1. **Technical** - Precision-focused interface that presents cryptographic verification tools with clarity and authority
2. **Trustworthy** - Clean, enterprise-grade design that instills confidence through clear data presentation and professional aesthetics
3. **Efficient** - Streamlined workflow that allows quick verification across multiple game types and platforms

**Complexity Level**: Light Application (multiple features with basic state)
This is a specialized utility tool with three distinct game verification modules, platform switching, and persistent verification history - more than a single-purpose tool but not requiring multiple complex views.

## Essential Features

### Platform Toggle
- **Functionality**: Switch between Stake and Roobet platforms
- **Purpose**: Different platforms have different game configurations (e.g., grid sizes in Mines)
- **Trigger**: User clicks platform selector at top of interface
- **Progression**: Click platform selector → Configuration updates → Grid/game constraints adjust → Visual feedback confirms switch
- **Success criteria**: Platform state persists, game configurations update correctly, UI reflects platform-specific constraints

### Global Configuration Panel
- **Functionality**: Accept cryptographic inputs (Server Seed Hash, Client Seed, Nonce, Mine Count)
- **Purpose**: Provide the cryptographic parameters needed for provably fair verification
- **Trigger**: User enters values into input fields
- **Progression**: Input field focus → Enter value → Real-time validation → Value stored → Ready for verification
- **Success criteria**: All inputs validated, constraints enforced (e.g., Mine Count max), values persist

### Mines Game Verification
- **Functionality**: Verify mine placements on a grid (5x5 for Stake, 5x5-8x8 for Roobet)
- **Purpose**: Allow users to verify that mine positions were predetermined and fair
- **Trigger**: User clicks "Verify" button after entering configuration
- **Progression**: Click Verify → Algorithm processes seeds → Grid cells highlight → Mine positions revealed → Result saved to history
- **Success criteria**: Correct mines highlighted, grid size adapts to platform, max mine count enforced

### Keno Game Verification
- **Functionality**: Verify 10 drawn numbers from a 40-number grid (8x5)
- **Purpose**: Prove that the 10 selected numbers were predetermined fairly
- **Trigger**: User switches to Keno tab and clicks Verify
- **Progression**: Switch to Keno → Enter configuration → Click Verify → 10 numbers highlight in emerald → Result saved
- **Success criteria**: Exactly 10 numbers highlighted, grid renders 1-40, emerald styling applied

### Crash Game Visualization
- **Functionality**: Animate an exponential crash curve with live multiplier display
- **Purpose**: Visualize the crash point prediction and demonstrate fairness
- **Trigger**: User switches to Crash tab
- **Progression**: Switch to Crash → Raw SVG loads → Click Verify → Curve animates upward → Multiplier counts up → Crashes at predetermined point → Line turns red
- **Success criteria**: Smooth 60fps animation using requestAnimationFrame, no charting libraries, exponential curve shape, dramatic crash effect

### Verification History
- **Functionality**: Persist verified results with all parameters
- **Purpose**: Allow users to review past verifications
- **Trigger**: Successful verification on any game tab
- **Progression**: Complete verification → Object saved to KV store → History updates → User can review past results
- **Success criteria**: Data persists across sessions, includes all relevant parameters (platform, game, seeds, nonce)

## Edge Case Handling

- **Invalid Mine Count**: Prevent verification if Mine Count exceeds grid size - 1; show validation error
- **Empty Required Fields**: Disable verify button until all required fields populated
- **Platform Switch Mid-Configuration**: Reset grid size to valid default for new platform
- **Rapid Verify Clicks**: Debounce or disable button during animation/processing
- **Crash Animation State**: Ensure clean restart when switching tabs or re-verifying

## Design Direction

The design should evoke a sense of **technical authority and cryptographic precision**. Think hacker terminal meets financial dashboard - dark, focused, with high-contrast emerald accents that signal verification success. The interface should feel like a professional auditing tool, not a game. Every element should communicate trust, accuracy, and mathematical certainty.

## Color Selection

Enterprise dark mode with high-tech emerald accents for a cryptographic/terminal aesthetic.

- **Primary Color**: Emerald Green (oklch(0.7 0.19 166)) - Represents verification success, trustworthiness, and the "provably fair" green light. Used for verify buttons, highlighted results, and success states.
- **Secondary Colors**: 
  - Slate 900 (oklch(0.17 0.01 256)) - Deep background that reduces eye strain
  - Slate 800 (oklch(0.22 0.01 256)) - Card surfaces that provide subtle elevation
  - Slate 700 (oklch(0.27 0.01 256)) - Borders and dividers
- **Accent Color**: Emerald 400 (oklch(0.75 0.18 166)) - Bright highlight for interactive elements and hover states
- **Foreground/Background Pairings**: 
  - Slate 900 Background (oklch(0.17 0.01 256)): Slate 100 text (oklch(0.95 0.01 256)) - Ratio 16.2:1 ✓
  - Slate 800 Cards (oklch(0.22 0.01 256)): Slate 50 text (oklch(0.98 0.005 256)) - Ratio 14.8:1 ✓
  - Emerald 500 Accent (oklch(0.7 0.19 166)): White text (oklch(1 0 0)) - Ratio 4.9:1 ✓
  - Destructive Red (oklch(0.62 0.25 28)): White text - Ratio 5.2:1 ✓

## Font Selection

Technical precision with excellent readability for displaying cryptographic hashes and numeric data.

- **Primary Font**: JetBrains Mono - Monospace font ideal for displaying hashes, seeds, and numeric values with perfect alignment
- **Secondary Font**: Inter - Clean sans-serif for UI labels, buttons, and descriptive text

- **Typographic Hierarchy**: 
  - H1 (Page Title): Inter Bold/32px/tight (-0.02em) letter spacing
  - H2 (Section Headers): Inter SemiBold/20px/normal letter spacing
  - H3 (Tab Labels): Inter Medium/16px/wide (0.02em) letter spacing
  - Body (Labels): Inter Regular/14px/normal letter spacing
  - Code (Seeds/Hashes): JetBrains Mono Regular/13px/normal letter spacing, monospace
  - Multiplier (Crash): JetBrains Mono Bold/64px/tight letter spacing

## Animations

Animations should emphasize **precision and technical feedback** rather than playful delight. The Crash graph animation is the centerpiece - smooth, exponential, and dramatic. Other animations should be subtle state transitions.

- **Crash Graph**: 60fps requestAnimationFrame-driven exponential curve animation with live multiplier counting (1.00x → crash point), smooth path drawing
- **Verify Button**: Quick scale pulse (0.98) on press, emerald glow on hover
- **Grid Cell Highlights**: Staggered fade-in (50ms delay per cell) when mines/numbers revealed
- **Tab Transitions**: Fast 150ms crossfade between game views
- **Platform Toggle**: Smooth 200ms slide animation on switch selector

## Component Selection

- **Components**: 
  - **Tabs** (shadcn) - Main game navigation (Mines/Keno/Crash)
  - **Card** (shadcn) - Configuration panel and game containers with slate-800 background
  - **Button** (shadcn) - Verify actions with emerald variant
  - **Input** (shadcn) - Cryptographic seed inputs with monospace font override
  - **Label** (shadcn) - Field labels with Inter font
  - **Select** (shadcn) - Grid size dropdown (Roobet only)
  - **Separator** (shadcn) - Visual divisions between sections
  - **Badge** (shadcn) - Platform indicator
  - **Grid (custom)** - CSS Grid for Mines and Keno game boards
  - **SVG (raw)** - Crash graph visualization (NO charting libraries)

- **Customizations**: 
  - Custom grid component with dynamic sizing (5x5 → 8x8)
  - Monospace font override for seed input fields
  - Emerald glow effect on verify button hover
  - Custom SVG path animation logic with requestAnimationFrame
  - Staggered cell highlight animations

- **States**: 
  - **Buttons**: Default (emerald-500), Hover (emerald-400 + shadow glow), Active (emerald-600), Disabled (slate-600)
  - **Inputs**: Default (slate-700 border), Focus (emerald-500 ring), Error (red-500 border + text)
  - **Grid Cells**: Default (slate-700), Highlighted/Mine (emerald-500 with fade-in), Keno Selected (emerald-500 glow)
  - **Platform Toggle**: Active (emerald-500), Inactive (slate-600)

- **Icon Selection**: 
  - **Check** (verification success states)
  - **Warning** (validation errors)
  - **GridFour** (Mines tab)
  - **NumberSquareEight** (Keno tab)
  - **TrendUp** (Crash tab)
  - **Database** (saved verifications)

- **Spacing**: 
  - Container padding: `p-6` (24px)
  - Section gaps: `gap-6` (24px)
  - Form field gaps: `gap-4` (16px)
  - Grid cell gaps: `gap-2` (8px)
  - Button padding: `px-6 py-2.5`

- **Mobile**: 
  - Stack configuration inputs vertically on <768px
  - Reduce grid cell size proportionally to fit viewport
  - Collapse platform toggle to icon-only on mobile
  - Tab labels shrink to icons on narrow screens
  - Crash graph maintains aspect ratio, scales down
  - Touch-friendly 44px minimum tap targets for all buttons
