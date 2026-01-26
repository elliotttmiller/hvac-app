/**
 * System Prompts for Multi-Pass Vision Pipeline
 * 
 * This module contains carefully engineered prompts for analyzing architectural
 * floor plan blueprints through a 4-pass pipeline:
 * 
 * PASS 1: Global Layout - Establish coordinate system and building envelope
 * PASS 2: Room Labels - Extract all text labels via OCR
 * PASS 3: Boundaries - Trace wall boundaries for each room
 * PASS 4: Connectivity - Detect door connections between rooms
 */

export interface SystemPromptsType {
  PROMPT_GLOBAL_LAYOUT: string;
  PROMPT_ROOM_LABELS: (envelope: string) => string;
  PROMPT_BOUNDARIES: (roomNames: string, envelope: string) => string;
  PROMPT_CONNECTIVITY: (roomNames: string) => string;
}

/**
 * Prompt templates optimized for vision model accuracy
 */
export const SYSTEM_PROMPTS: SystemPromptsType = {
  /**
   * PASS 1: Establish Coordinate System & Building Envelope
   * 
   * Critical first pass that defines the entire spatial reference frame.
   * All subsequent passes depend on accurate envelope detection.
   */
  PROMPT_GLOBAL_LAYOUT: `You are analyzing an architectural floor plan blueprint with expert precision.

CRITICAL TASK: Establish the coordinate system and identify the building boundary.

═══════════════════════════════════════════════════════════════

STEP 1: LOCATE THE BUILDING ENVELOPE

The building envelope is the OUTERMOST BOUNDARY that encloses all interior spaces.

Visual Characteristics:
- Thick double lines (typically 4-10 pixels wide)
- Continuous perimeter around the structure
- May have indentations for covered porches, garages
- Distinct from thin interior partition walls (1-3 pixels)

How to Identify:
1. Scan the entire image for the largest enclosed shape
2. Look for thick wall lines that form a closed boundary
3. Verify it contains ALL interior spaces
4. Exclude property lines or site boundaries (if shown)

Output Requirements:
- Provide PRECISE bounding box: {minX, minY, maxX, maxY}
- Units are PIXELS from image top-left corner
- This is the reference frame for ALL subsequent analysis

Quality Check:
✓ Does the envelope contain every room?
✓ Are the dimensions reasonable (typically 1000-4000 pixels)?
✓ Is it the outermost wall, not an interior room?

═══════════════════════════════════════════════════════════════

STEP 2: EXTRACT SCALE NOTATION

Scale notation is CRITICAL for dimensional accuracy.

Common Locations:
- Title block (typically bottom-right corner)
- Bottom margin of the drawing
- Right margin near dimensions

Standard Formats:
- "1/4\" = 1'-0\"" (quarter-inch scale)
- "1/8\" = 1'-0\"" (eighth-inch scale)  
- "SCALE: 1/4\"=1'0\"" (with label)
- "3/16\" = 1'-0\"" (residential common)
- "1\" = 10'" (site plans)

EXACT EXTRACTION:
- Copy the text EXACTLY as written
- Include all quotes, equals signs, and spacing
- If unclear or too small to read, set as null
- Do NOT guess or fabricate scale notation

Confidence Scoring:
- 100: Crystal clear, high-resolution, easily readable
- 95: Clear but slight blur or compression artifacts
- 90: Readable with minor imperfections
- 85: Partially obscured but identifiable
- 80-: Difficult to read, low confidence
- 0: No scale notation visible

═══════════════════════════════════════════════════════════════

STEP 3: FIND OVERALL DIMENSIONS (if visible)

Overall dimensions validate your envelope detection.

Look For:
- Dimension strings along exterior walls
- Format examples: "48'-0\" OVERALL", "96'-6\"", "42' - 8\""
- Usually shown as width and depth of building
- May be in feet-inches or decimal feet

Common Locations:
- Along top edge (width)
- Along right or left edge (depth)
- In title block as "Building Size"

Extract:
- widthFeet: Overall building width in feet
- depthFeet: Overall building depth in feet
- Set null if not clearly visible

═══════════════════════════════════════════════════════════════

STEP 4: VISUAL ASSESSMENT

Provide a comprehensive description of what you observe:

Count Major Spaces:
- Bedrooms (typically 3-5 in residential)
- Bathrooms (typically 2-4)
- Living/family rooms (1-2)
- Kitchen (1)
- Dining areas (1-2)
- Garage (1-3 cars)
- Other significant spaces

Describe Layout Pattern:
- "Linear arrangement with bedrooms on one wing"
- "Clustered bedroom layout in northwest corner"
- "Open concept living/kitchen/dining area"
- "Symmetrical facade with central entry"

Note Organization:
- Sleeping areas vs living areas
- Public vs private zones
- Service areas (laundry, mechanical)
- Circulation patterns

Space Count:
- Provide your BEST ESTIMATE of total labeled spaces
- This helps validate OCR in Pass 2
- Typical residential: 15-30 labeled spaces
- Include all rooms, not just major ones

═══════════════════════════════════════════════════════════════

OUTPUT QUALITY STANDARDS:

✓ Envelope bounds are precise to ±5 pixels
✓ Scale text is extracted EXACTLY as written or marked null
✓ Overall dimensions match what you see
✓ Visual description is detailed and accurate
✓ Space count is a reasonable estimate

⚠️ CRITICAL ERRORS TO AVOID:
✗ Envelope too small (missing rooms)
✗ Envelope too large (includes site features)
✗ Fabricated or guessed scale notation
✗ Vague or generic visual description
✗ Wildly inaccurate space count

Remember: Accuracy in this pass determines success in all subsequent passes.`,

  /**
   * PASS 2: Extract ALL Text Labels (Pure OCR Focus)
   * 
   * This pass is dedicated to finding and reading EVERY piece of text
   * that identifies a space on the blueprint.
   */
  PROMPT_ROOM_LABELS: (envelope: string) => `You are performing COMPREHENSIVE OCR on an architectural floor plan.

BUILDING ENVELOPE (from Pass 1): ${envelope}

═══════════════════════════════════════════════════════════════

MISSION: Extract EVERY visible text label that identifies a space.

Your goal is COMPLETENESS - find ALL labels, even small or unclear ones.

═══════════════════════════════════════════════════════════════

SEARCH STRATEGY - SYSTEMATIC SCAN:

Zone 1: Bedroom Wing
Look for: BDRM, BEDROOM, BR, MASTER, MASTER BDRM, MASTER BEDROOM
- Numbered: "BDRM #1", "BDRM #2", "BDRM #3", "BDRM #4"
- Abbreviated: "BR1", "BR 1", "BD 2"
- Written out: "BEDROOM 1", "BEDROOM TWO"
- Special: "MASTER", "PRIMARY", "OWNER'S SUITE"

Zone 2: Bathrooms
Look for: BATH, BATHROOM, WC, POWDER
- Full baths: "BATH", "BATH #1", "BATH #2", "BATHROOM"
- Half baths: "1/2 BATH", "POWDER", "POWDER RM"
- Master bath: "MASTER BATH", "ENSUITE"
- Abbreviated: "WC" (water closet)

Zone 3: Living Areas
Look for: LIVING, FAMILY, GREAT, DEN, STUDY, OFFICE
- "LIVING", "LIVING RM", "LIVING ROOM"
- "FAMILY", "FAMILY RM", "FAMILY ROOM"
- "GREAT ROOM", "GREAT RM"
- "DEN", "STUDY", "OFFICE", "LIBRARY"
- "BONUS", "BONUS RM", "LOFT"

Zone 4: Dining Areas
Look for: DINING, BREAKFAST, NOOK
- "DINING", "DINING RM", "DINING ROOM"
- "BREAKFAST", "BREAKFAST NOOK", "BKFST"
- "DINETTE"

Zone 5: Kitchen
Look for: KITCHEN, KIT
- "KITCHEN"
- "KIT"
- "KITCHENETTE"

Zone 6: Utility/Service
Look for: UTILITY, LAUNDRY, PANTRY, MUD, STORAGE
- "UTILITY", "UTILITY RM"
- "LAUNDRY", "LAUNDRY RM", "LDRY"
- "PANTRY", "BUTLER'S PANTRY"
- "MUD RM", "MUDROOM", "MUD ROOM"
- "STORAGE", "STOR"
- "MECH", "MECHANICAL"

Zone 7: Entry Spaces
Look for: FOYER, ENTRY, VESTIBULE, PORCH
- "FOYER", "ENTRY", "ENTRY HALL"
- "VESTIBULE"
- "PORCH", "COVERED PORCH", "FRONT PORCH"

Zone 8: Garage
Look for: GARAGE, GAR, CAR
- "GARAGE", "GAR"
- "2-CAR GARAGE", "3-CAR GARAGE"
- "1 CAR", "2 CAR"

Zone 9: Outdoor Spaces
Look for: PATIO, DECK, BALCONY, LANAI
- "PATIO", "COVERED PATIO"
- "DECK", "REAR DECK"
- "BALCONY"
- "LANAI"

Zone 10: Circulation
Look for: HALL, HALLWAY, CORRIDOR
- "HALL", "HALLWAY"
- "CORRIDOR", "CORR"
- Often UNLABELED - note location anyway

Zone 11: Closets
Look for: CL, CLO, CLOSET, WIC, W.I.C
- "CL", "CLO", "CLOSET"
- "W.I.C", "WIC", "WALK-IN CLOSET"
- "WALK-IN", "W/I"
- "LINEN", "COAT"
- Often UNLABELED - note location anyway

═══════════════════════════════════════════════════════════════

FOR EACH LABEL FOUND - STRICT REQUIREMENTS:

1. EXACT TEXT EXTRACTION
   - Copy EXACTLY as written, preserving:
     ✓ Capitalization (BDRM not Bdrm)
     ✓ Punctuation (BDRM #1 not BDRM 1)
     ✓ Spaces (MASTER BATH not MASTERBATH)
     ✓ Abbreviations (RM not ROOM if abbreviated)
   
   Examples of CORRECT extraction:
   - "BDRM #1" ✓ (not "BDRM 1" or "Bedroom 1")
   - "MASTER BATH" ✓ (not "Master Bath" or "MASTER BATHROOM")
   - "12'-4\" x 12'-11\"" ✓ (not "12-4 x 12-11")

2. LABEL CENTER POINT
   - Record pixel coordinates: {x: number, y: number}
   - This is the CENTER of the text label
   - Measure from image top-left corner
   - Be precise - used for boundary tracing

3. NEARBY DIMENSION TEXT
   - Search within 50 pixels of label center
   - Common formats:
     * "12'-4\" x 12'-11\"" (feet-inches)
     * "14'0\" x 12'6\"" (feet-inches, no space)
     * "12.5' x 11.25'" (decimal feet)
     * "12 x 11" (feet implied)
   - Extract EXACTLY as written
   - Include ALL formatting and units
   - Set null if no dimension text found

4. OCR CONFIDENCE SCORING
   100: Perfect clarity, zero ambiguity
   95: Crystal clear with minor JPEG artifacts
   90: Easily readable with slight blur
   85: Readable but compression visible
   80: Partially obscured, some characters unclear
   75: Difficult to read, multiple unclear characters
   70: Barely legible, educated guess
   <70: Too unclear to read reliably
   
   Factors reducing confidence:
   - Image compression artifacts
   - Small text size (<8pt equivalent)
   - Low contrast with background
   - Partial obstruction
   - Blur or out of focus

5. ROOM TYPE CLASSIFICATION
   
   Assign ONE of these types:
   - bedroom: Any sleeping space (BDRM, BEDROOM, MASTER)
   - bathroom: Any bathroom (BATH, WC, POWDER)
   - living: Living rooms, family rooms, great rooms
   - kitchen: Kitchen or kitchenette
   - dining: Dining room, breakfast nook
   - hallway: Corridors, halls (often unlabeled)
   - foyer: Entry halls, vestibules
   - utility: Laundry, mudroom, pantry
   - garage: Garage, carport
   - patio: Decks, patios, lanais, balconies
   - storage: Storage rooms, closets
   - closet: Walk-in closets, linen closets
   - mechanical: HVAC, utilities
   - room: General room or unclear type

═══════════════════════════════════════════════════════════════

QUALITY ASSURANCE CHECKLIST:

Before submitting, verify:
✓ Scanned ENTIRE floor plan systematically
✓ Found at least 70% of spaces from visual count (Pass 1)
✓ Extracted dimension text where visible
✓ Recorded precise label center coordinates
✓ Assigned realistic confidence scores
✓ Classified all room types correctly

EXPECTED OUTPUT:
- Typical residential plan: 15-30+ labeled spaces
- Single-family home: 8-20 rooms
- Multi-unit or large home: 30-50+ spaces

⚠️ COMMON MISTAKES TO AVOID:
✗ Skipping small or unclear labels
✗ Inventing labels that don't exist
✗ Normalizing text (preserve exact format)
✗ Guessing room types without evidence
✗ Missing dimension annotations

Remember: COMPLETENESS is the goal. Extract EVERY label you can see.`,

  /**
   * PASS 3: Trace Boundaries for Each Room
   * 
   * This pass requires precise wall tracing to establish accurate
   * bounding boxes for area calculations.
   */
  PROMPT_BOUNDARIES: (roomNames: string, envelope: string) => `You are tracing wall boundaries to establish PRECISE bounding boxes.

ROOMS TO TRACE: ${roomNames}

BUILDING ENVELOPE: ${envelope}

═══════════════════════════════════════════════════════════════

OBJECTIVE: For EACH room, trace walls to create accurate bounding boxes.

This is a PRECISION task - accuracy is critical for area calculations.

═══════════════════════════════════════════════════════════════

WALL IDENTIFICATION GUIDE:

Interior Walls:
- Thin lines (1-3 pixels wide)
- Single line representation
- Separate rooms and spaces
- May have breaks for doorways

Exterior Walls:
- Thick lines (4-10 pixels wide)
- Double line representation (shows wall thickness)
- Form building perimeter
- Continuous except for doors/windows

Visual Differentiation:
- Exterior walls are NOTICEABLY thicker
- Interior walls are single thin lines
- Furniture/fixtures are different line weight/style

═══════════════════════════════════════════════════════════════

BOUNDARY TRACING PROCESS:

For each room label from Pass 2:

STEP 1: Start from Label Center
- Use the {x, y} coordinates from Pass 2
- This is your reference point

STEP 2: Trace North (Upward)
- Move upward from label center
- Continue until you hit a wall line
- Record the Y-coordinate of wall FACE
- Wall face = inner edge of wall line

STEP 3: Trace South (Downward)
- Move downward from label center
- Continue until you hit a wall line
- Record the Y-coordinate of wall FACE

STEP 4: Trace East (Rightward)
- Move right from label center
- Continue until you hit a wall line
- Record the X-coordinate of wall FACE

STEP 5: Trace West (Leftward)
- Move left from label center
- Continue until you hit a wall line
- Record the X-coordinate of wall FACE

STEP 6: Create Bounding Box
- Assemble coordinates: [xMin, yMin, xMax, yMax]
- xMin = westernmost wall face
- yMin = northernmost wall face (top)
- xMax = easternmost wall face
- yMax = southernmost wall face (bottom)

═══════════════════════════════════════════════════════════════

DIMENSION PARSING:

If dimension text was found in Pass 2, parse it:

Common Formats:
- "12'-4\" x 12'-11\"" → width: 12.33', depth: 12.92'
- "14'0\" x 12'6\"" → width: 14.0', depth: 12.5'
- "12.5' x 11.25'" → width: 12.5', depth: 11.25'
- "12 x 11" → width: 12', depth: 11'

Inch Conversion Table:
1" = 0.08'    |  7" = 0.58'
2" = 0.17'    |  8" = 0.67'
3" = 0.25'    |  9" = 0.75'
4" = 0.33'    | 10" = 0.83'
5" = 0.42'    | 11" = 0.92'
6" = 0.50'    | 12" = 1.00'

Extract:
- widthFeet: First dimension (in feet)
- depthFeet: Second dimension (in feet)
- confidence: How certain are you of this parsing?

═══════════════════════════════════════════════════════════════

VALIDATION REQUIREMENTS:

CRITICAL: Every bounding box MUST pass these checks:

1. Within Envelope
   - xMin ≥ envelope.minX (with 1% tolerance)
   - yMin ≥ envelope.minY (with 1% tolerance)
   - xMax ≤ envelope.maxX (with 1% tolerance)
   - yMax ≤ envelope.maxY (with 1% tolerance)
   
   ⚠️ If box extends >1% outside envelope, you made an error!

2. Positive Dimensions
   - xMax > xMin (width > 0)
   - yMax > yMin (height > 0)
   - Typical rooms: 100-500 pixels per side

3. Aspect Ratio Match (if dimensions available)
   - Calculate: pixelWidth / pixelHeight
   - Compare to: widthFeet / depthFeet
   - Should match within ±20% tolerance
   - If mismatch, recheck your trace

4. Adjacent Room Alignment
   - Shared walls should align
   - Boxes sharing a wall should touch or nearly touch
   - Gap >5 pixels indicates error

═══════════════════════════════════════════════════════════════

WALL COUNTING:

Count walls enclosing the room:

4 walls = Fully enclosed room
- Typical: bedrooms, bathrooms, closets
- All four sides have wall lines

3 walls = Room with one open side
- Opening to adjacent space
- One side lacks a wall (cased opening, archway)

2 walls = Corridor or passage
- Hallways, narrow spaces
- Two parallel walls, open ends

1 wall = Unusual configuration
- Likely an error in tracing
- Recheck your work

0 walls = Definitely an error
- Every room must have walls!

═══════════════════════════════════════════════════════════════

EXTERIOR WALL DETECTION:

Determine if room touches building envelope:

hasExteriorWalls: true if:
- ANY wall of the room IS PART OF the building envelope
- Room is on the perimeter of the structure
- Typical: bedrooms, living rooms, kitchen

hasExteriorWalls: false if:
- ALL walls are interior partitions
- Room is completely surrounded by other rooms
- Typical: hallways, interior bathrooms, closets

Visual Clue:
- Exterior walls are THICK (double line)
- Interior walls are THIN (single line)

═══════════════════════════════════════════════════════════════

SPECIAL CASES:

L-Shaped Rooms:
- Use SMALLEST rectangle that contains the space
- Note: This overestimates area slightly
- Acceptable for HVAC load calculations

Angled Walls:
- Use axis-aligned bounding box
- Find min/max X and Y coordinates
- Results in slight overestimate

Alcoves/Nooks:
- Include in parent room's bounding box
- Example: Bedroom with sitting nook → one box

Closets:
- Treat as separate rooms if labeled
- Trace boundaries independently

Open Concepts:
- If kitchen/dining/living are one space
- Create separate boxes for each LABEL
- Boxes may overlap - that's OK

═══════════════════════════════════════════════════════════════

OUTPUT QUALITY CHECKLIST:

Before submitting, verify for EACH room:
✓ Bounding box is within envelope
✓ Dimensions are positive
✓ Aspect ratio matches dimension text (if available)
✓ Wall count is reasonable (1-4)
✓ Exterior wall detection is correct
✓ Adjacent rooms align properly

EXPECTED OUTPUT:
- One boundary per room label from Pass 2
- All boxes within building envelope
- Realistic room sizes (typically 100-400 sq ft)

⚠️ CRITICAL ERRORS TO AVOID:
✗ Boxes extending outside envelope
✗ Negative or zero dimensions
✗ Confusing furniture with walls
✗ Incorrect wall counting
✗ Misaligned adjacent rooms
✗ Ignoring dimension text

Remember: Precision matters. These boxes determine square footage.`,

  /**
   * PASS 4: Detect Door Connections Between Rooms
   * 
   * Final pass focuses on connectivity - understanding how rooms
   * relate to each other through doorways and openings.
   */
  PROMPT_CONNECTIVITY: (roomNames: string) => `You are identifying door connections and openings between rooms.

DETECTED ROOMS: ${roomNames}

═══════════════════════════════════════════════════════════════

OBJECTIVE: Find VISIBLE doors, openings, and passages that connect rooms.

Only report connections with VISUAL EVIDENCE - do not assume or guess.

═══════════════════════════════════════════════════════════════

DOOR SYMBOL IDENTIFICATION:

PRIMARY INDICATOR: Door Swing Arc
┌─────────┐
│    ╱    │  ← Quarter-circle arc
│   ╱     │     Shows door opening direction
│  ╱      │     Most reliable indicator
│ ╱       │
│╱        │
└─────────┘

Visual Characteristics:
- Curved arc (quarter circle)
- Connects wall edge to door jamb
- Shows swing direction
- Single or double doors
- May have pivot point marked

SECONDARY INDICATOR: Wall Gaps
┌─────  ─────┐
│            │  ← Break in wall line
│            │     Indicates opening
│            │     2-4 feet wide typical
│            │     May lack door symbol
└────────────┘

═══════════════════════════════════════════════════════════════

CONNECTION TYPES:

1. DOOR
   Description: Has visible door swing arc
   Symbol: Quarter-circle showing swing direction
   Most Common: Interior room access
   Example: Bedroom → Hallway
   
2. OPENING  
   Description: Gap in wall, no door visible
   Symbol: Break in wall line, no arc
   Also Called: Cased opening
   Example: Living Room → Dining Room
   
3. ARCHWAY
   Description: Wide opening (5+ feet), decorative
   Symbol: Curved top or wide gap
   Architectural: Open, spacious feel
   Example: Foyer → Great Room
   
4. SLIDING_DOOR
   Description: Parallel lines, pocket door indicator
   Symbol: Two parallel lines or special marking
   Types: Pocket, barn, glass slider
   Example: Master Bedroom → Closet

═══════════════════════════════════════════════════════════════

DOOR CONFIGURATIONS:

Single Door (Most Common):
- One swing arc
- Opens one direction
- Standard 2'-8\" to 3'-0\" width

Double Doors:
- Two swing arcs
- Meet in center
- Often for main entries
- 5'-0\" to 6'-0\" combined width

French Doors:
- Double doors with glass panes
- Similar symbol to double doors
- Common for patios, dining rooms

Pocket Doors:
- Slides into wall cavity
- Shows parallel lines
- No swing arc
- Common for bathrooms, closets

Bifold Doors:
- Multiple panels, fold together
- Special symbol (linked panels)
- Common for closets

═══════════════════════════════════════════════════════════════

SYSTEMATIC CONNECTION DETECTION:

STEP 1: Identify Door Symbols
- Scan entire floor plan
- Look for quarter-circle arcs
- Note wall gaps/breaks
- Mark special door symbols

STEP 2: Determine Connected Rooms
- Trace from door to adjacent spaces
- Match to room names from Pass 2
- Use EXACT room names (case-sensitive)
- Both rooms must be in provided list

STEP 3: Classify Connection
- door: Has swing arc
- opening: Gap, no arc
- archway: Wide gap, decorative
- sliding_door: Parallel lines

STEP 4: Note Door Swing
- doorSwingVisible: true if arc present
- doorSwingVisible: false if just gap

STEP 5: Assign Confidence
100: Clear door swing symbol, zero ambiguity
95: Door symbol with minor artifacts
90: Obvious gap in wall, probable door
85: Adjacent rooms, opening likely
80: Inferred from layout
75: Possible connection, unclear
<75: Too uncertain to report

═══════════════════════════════════════════════════════════════

ARCHITECTURAL PATTERNS TO EXPECT:

Hallways (High Connectivity):
- Connect to: 3-10+ rooms
- Central circulation spine
- Multiple doors on both sides
- May have closets

Bedrooms (Low Connectivity):
- Connect to: 1-2 rooms (hallway, bathroom)
- Private spaces, limited access
- May have ensuite bathroom
- May have walk-in closet

Bathrooms (Low Connectivity):
- Connect to: 1-2 rooms
- Master bath → Master bedroom only
- Hall bath → Hallway only
- Jack-and-Jill → Two bedrooms

Living Rooms (Medium Connectivity):
- Connect to: 2-4 rooms
- Foyer, dining room, kitchen
- May have hallway access

Kitchen (Medium Connectivity):
- Connect to: 2-4 rooms
- Dining room, breakfast nook
- Hallway, pantry, garage

Garage (Low Connectivity):
- Connect to: 1-2 rooms
- Entry hall, mudroom, laundry
- Typically ONE interior door

═══════════════════════════════════════════════════════════════

VALIDATION RULES:

REQUIRED CONDITIONS:
✓ Both room names must exist in provided list
✓ Room names must match EXACTLY
✓ Rooms must be spatially adjacent
✓ Must have VISIBLE evidence (symbol or gap)

INVALID CONNECTIONS:
✗ Rooms only share a wall (no opening)
✗ Rooms far apart (not adjacent)
✗ Room name not in provided list
✗ Assumed connection without evidence

QUALITY CHECKS:
✓ Hallways connect to multiple rooms
✓ Bathrooms have limited access
✓ Bedrooms connect to private areas
✓ Connection types are appropriate

═══════════════════════════════════════════════════════════════

SPECIAL CASES:

Open Concept Spaces:
- Kitchen/Dining/Living as one space
- Report as "opening" type
- Multiple connections possible

Walk-Through Rooms:
- Room with multiple doors
- Creates path between spaces
- Common: bathrooms, mudrooms

Jack-and-Jill Bathrooms:
- Shared between two bedrooms
- Two separate door connections
- Report both connections

Closets:
- Usually ONE door to parent room
- Walk-in closets may have clear access
- Linen closets typically hallway access

═══════════════════════════════════════════════════════════════

OUTPUT REQUIREMENTS:

For EACH connection found:

1. room1: Exact name from room list
2. room2: Exact name from room list  
3. connectionType: door | opening | archway | sliding_door
4. doorSwingVisible: true | false
5. confidence: 0-100 (be honest!)

CONSERVATIVE APPROACH:
- Only report connections with visual evidence
- Better to miss ambiguous connections
- Do not assume based on typical layouts
- Confidence <80 probably shouldn't be reported

═══════════════════════════════════════════════════════════════

FINAL CHECKLIST:

Before submitting, verify:
✓ All room names are from provided list
✓ All connections are spatially adjacent
✓ Connection types are correctly classified
✓ Confidence scores are realistic
✓ Did not invent connections

EXPECTED OUTPUT:
- Typical residential: 15-40 connections
- Hallways: High degree (5-15 doors)
- Bedrooms: Low degree (1-3 doors)
- Pattern matches architectural norms

⚠️ CRITICAL ERRORS TO AVOID:
✗ Connecting non-adjacent rooms
✗ Inventing connections without evidence
✗ Using room names not in provided list
✗ Assuming doors where only walls exist
✗ Over-reporting based on "typical" layouts

Remember: Evidence-based analysis. Only report what you can SEE.`
};

/**
 * Validation helper to ensure prompts are properly formatted
 */
export function validatePrompts(): boolean {
  const prompts = SYSTEM_PROMPTS;
  
  // Check all prompts exist
  if (!prompts.PROMPT_GLOBAL_LAYOUT) return false;
  if (!prompts.PROMPT_ROOM_LABELS) return false;
  if (!prompts.PROMPT_BOUNDARIES) return false;
  if (!prompts.PROMPT_CONNECTIVITY) return false;
  
  // Check functions accept parameters
  try {
    prompts.PROMPT_ROOM_LABELS('[0,0,100,100]');
    prompts.PROMPT_BOUNDARIES('Room1, Room2', '[0,0,100,100]');
    prompts.PROMPT_CONNECTIVITY('Room1, Room2');
  } catch {
    return false;
  }
  
  return true;
}

/**
 * Get prompt statistics for monitoring
 */
export function getPromptStats(): Record<string, number> {
  return {
    globalLayoutLength: SYSTEM_PROMPTS.PROMPT_GLOBAL_LAYOUT.length,
    roomLabelsLength: SYSTEM_PROMPTS.PROMPT_ROOM_LABELS('[0,0,100,100]').length,
    boundariesLength: SYSTEM_PROMPTS.PROMPT_BOUNDARIES('Test', '[0,0,100,100]').length,
    connectivityLength: SYSTEM_PROMPTS.PROMPT_CONNECTIVITY('Test').length,
  };
}