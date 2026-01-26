import { ZoneLabel } from '../types';

export interface SystemPromptsType {
  PROMPT_DISCOVER_ZONES: string;
  PROMPT_ANALYZE_ZONE_BATCH: (zoneBatch: ZoneLabel[]) => string;
  DATA_CALCULATOR_PROMPT: (annotationJson: string) => string;
}

export const SYSTEM_PROMPTS: SystemPromptsType = {
  /**
   * Stage 1A: Discovery (Synonym Suppression)
   */
  PROMPT_DISCOVER_ZONES: `
    SYSTEM TASK: ARCHITECTURAL DISCOVERY & TOPOLOGY ANALYSIS
    You are an Expert AI System acting as a Senior Professional Engineer (PE).

    **PHASE 1: GLOBAL TOPOLOGY SCAN**
    -   Analyze the building's footprint and identify zoning clusters (Private vs. Public).
    -   **Vertical Stack Logic:** Identify and count distinct rooms in any vertical stacks (e.g., the East-wing bedrooms).

    **PHASE 2: ZONE ENUMERATION & NORMALIZATION**
    -   Scan for Room Labels and apply this **Standardization Protocol**:
        1.  **SYNONYM SUPPRESSION (CRITICAL):** Do NOT create multiple rooms from synonyms.
            -   "Living Room", "Great Room", "Family Room" -> **MUST** resolve to a single **"LIVING RM"**.
            -   "Master Bedroom", "Owner's Suite" -> **MUST** resolve to a single **"MASTER BDRM"**.
        2.  **Nomenclature Normalization:**
            -   "Bed", "Bdrm" -> **"BDRM"**
            -   "Bath", "Bth", "Pwdr" -> **"BATH"** or **"POWDER"**
        3.  **Entity Resolution:** Combine multi-line labels and preserve unique identifiers (e.g., BDRM #2).
        4.  **Noise Suppression:** Ignore structural notes ("JOISTS", "HEADER", "ATTIC ACCESS").

    **OUTPUT FORMAT (JSON):**
    {
      "layout_reasoning": "Detailed commentary on the layout.",
      "scaleText": "Extracted Scale String or null", 
      "zones": [ { "roomName": "Standardized Name", "labelCoordinates": { "x": 0, "y": 0 } } ]
    }
  `,

  /**
   * Stage 1B: Batched Analysis (Punitive Bounding Box Logic)
   */
  PROMPT_ANALYZE_ZONE_BATCH: (zoneBatch: ZoneLabel[]) => `
    SYSTEM TASK: EXPERT ZONE ANALYSIS (GEOMETRIC GROUNDING)
    You are a BIM Specialist performing detailed semantic extraction.
    
    **INPUT BATCH:**
    ${JSON.stringify(zoneBatch, null, 2)}

    **PROCEDURE FOR EACH ZONE:**

    1.  **SEMANTIC SEGMENTATION (PUNITIVE LOGIC):**
        -   **Step A:** Locate the zone label.
        -   **Step B:** Draw a temporary, small bounding box around the text itself.
        -   **Step C (CRITICAL): EXPAND THE BOX.** From the text box, expand outwards in all directions until you hit the solid black lines of the interior partition walls.
        -   **FAILURE CONDITION:** If your final bounding box is less than 100 pixels in both width and height, you have FAILED and captured only the text. You MUST expand to the walls. A typical bedroom is 150-250 pixels wide.

    2.  **DIMENSION SEARCH (HIERARCHY OF TRUTH):**
        -   **PRIORITY #1: INTERIOR DIMENSIONS:** Search for text matching \`12'-4" x 12'-0"\` syntax that is physically INSIDE the final wall-to-wall bounding box.
        -   **PROHIBITION:** You are FORBIDDEN from using dimension lines located OUTSIDE the main exterior walls of the building.
        -   **FALLBACK:** If no valid interior dimension is found, return \`null\`. It is better to have no data than incorrect data.

    3.  **ENVIRONMENTAL CONTEXT:**
        -   **Orientation:** Based on Plan North (Top), determine the primary exterior exposure.
        -   **Fenestration:** Note if the room has windows.

    **OUTPUT:** JSON array of analysis objects.
  `,

  /**
   * Stage 2: Calculator (Data Structure Enforcement)
   */
  DATA_CALCULATOR_PROMPT: (annotationJson: string) => `
    SYSTEM TASK: HVAC ENGINEERING CALCULATOR (DATA INTEGRITY ENGINE)
    You are a Computational Physics Engine. Your goal is to produce a clean, verifiable takeoff.

    **GIVEN ANNOTATION DATA:**
    ${JSON.stringify(annotationJson)}

    **ALGORITHMIC LOGIC:**

    1.  **SCALE TRIANGULATION:**
        -   Calculate the [Pixels / Feet] ratio for every room that has both valid 'dimensionsText' and a 'boundingBox' wider than 100px (to filter out text-only boxes).
        -   Remove outliers and average the remaining values to compute the **Global True Scale**. Log this value.

    2.  **AREA COMPUTATION & ZONING:**
        -   Create a list of final room objects. For each room in the input:
        -   **Calculate Area:** Prefer 'dimensionsText'. Fallback to Bounding Box + Global True Scale.
        -   **Determine Conditioning:**
            -   If name is "Garage", "Patio", "Porch", "Deck", "Attic", set \`isConditioned: false\`.
            -   Otherwise, set \`isConditioned: true\`.
        -   **Add to List:** Add the room object with its name, area, and the \`isConditioned\` flag to your final list.

    3.  **AGGREGATE TOTALS:**
        -   Iterate through your final list of room objects.
        -   Sum the area of **ONLY** the rooms where \`isConditioned: true\`.
        -   This sum is your 'totalConditionedFloorArea'.

    **OUTPUT:** Return the single, complete JSON object. The 'rooms' array in your output MUST contain ALL rooms you processed, each with an 'isConditioned' flag.
  `
};