import { ZoneLabel } from '../types';

export interface SystemPromptsType {
  PROMPT_DISCOVER_ZONES: string;
  PROMPT_ANALYZE_ZONE_BATCH: (zoneBatch: ZoneLabel[]) => string;
  DATA_CALCULATOR_PROMPT: (annotationJson: string) => string;
}

export const SYSTEM_PROMPTS: SystemPromptsType = {
  /**
   * Stage 1A: Discovery (Visual Chain of Thought)
   */
  PROMPT_DISCOVER_ZONES: `
    SYSTEM TASK: ARCHITECTURAL DISCOVERY (VISUAL REASONING MODE)
    You are an expert AI OCR Engineer. Your goal is to build a precise mental model of the floor plan before extracting data.

    **STEP 1: VISUAL SCAN (Mental Scratchpad)**
    -   Scan the image from Top-Left to Bottom-Right.
    -   Identify the "Bedroom Wing" (usually a cluster of rooms).
    -   **VERTICAL STACK CHECK:** Look specifically for rooms stacked vertically (North-to-South) that share the same wall alignment.
    -   *Crucial:* If you see a column of rooms, read the label of the TOP room, then the MIDDLE room, then the BOTTOM room. Do NOT assume they are the same just because they are the same size.
    -   *Verify:* Are there unique numbers? (e.g., #4, #6, #5, #3). If yes, they are DISTINCT zones.

    **STEP 2: EXTRACTION (Data Generation)**
    -   **Scale:** Locate explicit scale text (e.g., "SCALE: 1/4\" = 1'-0\"").
    -   **Zones:** Extract the label for every DISTINCT physical room identified in Step 1.
    
    **INTELLIGENCE RULES:**
    1.  **Strict Grounding:** Only output a room if you can read its specific label text.
    2.  **Anti-Hallucination:** Do not infer sequential rooms. If you see "Bedroom 3", do not create "Bedroom 4" unless you see the text "Bedroom 4".
    3.  **Spatial Clustering:** Combine "MASTER", "BEDROOM", and dimensions into ONE label.
    4.  **Noise Filtering:** Ignore "ATTIC ACCESS", "JOISTS", "HEADER".

    **OUTPUT FORMAT (JSON):**
    {
      "layout_reasoning": "I see a vertical stack of 4 bedrooms on the right side...",
      "scaleText": "1/4\" = 1'-0\"", 
      "zones": [ ... ]
    }
  `,

  /**
   * Stage 1B: Batched Analysis (Geometric Verification)
   */
  PROMPT_ANALYZE_ZONE_BATCH: (zoneBatch: ZoneLabel[]) => `
    SYSTEM TASK: FOCUSED BATCH ZONE ANALYSIS
    You are an expert Architectural Blueprint Analyst.
    
    **INPUT BATCH:**
    ${JSON.stringify(zoneBatch, null, 2)}

    **INSTRUCTIONS:**
    1.  Locate each zone on the blueprint.
    2.  **CRITICAL:** Trace the **INTERIOR WALL BOUNDARIES**. Do not just draw a box around the text label. The box must represent the physical floor area.
    3.  **READ DIMENSIONS CAREFULLY:** 
        -   Look closely at the dimension text (e.g., "12'-4\\" x 12'-11\\"").
        -   **Common OCR Errors:** Do not confuse "11" with "8", or "4" with "1".
        -   *Self-Correction:* If the text looks like "11'-8"" but the room is visually square (12x12), re-read the text. It might be "11'-11"" or "12'-11"".
    4.  If no dimension text is found, return null.
    5.  Provide a brief "reasoning" string.

    **OUTPUT:** JSON array of analysis objects.
  `,

  /**
   * Stage 2: Calculator (Logic Filtering)
   */
  DATA_CALCULATOR_PROMPT: (annotationJson: string) => `
    SYSTEM TASK: HVAC TAKEOFF CALCULATOR (LOGIC & MATH)
    You are a data processing engine. Calculate square footage and filter conditioned space.

    **GIVEN ANNOTATION DATA:**
    ${annotationJson}

    **EXECUTION STEPS (Follow Precisely in 'math_trace'):**

    1.  **STEP 1: ANALYZE SCALE**
        -   Derive the true scale by comparing a room's 'dimensionsText' to its 'boundingBox' pixel width.
        -   Use this Derived Scale for all calculations.

    2.  **STEP 2: CALCULATE AREA & CONDITIONING**
        -   For each room, calculate Area = (Width_px / Scale) * (Height_px / Scale).
        -   **DETERMINE CONDITIONING:**
            -   **Unconditioned (Exclude):** Garage, Patio, Porch, Deck, Attic, Crawlspace.
            -   **Conditioned (Include):** Living, Sleeping, Hygiene, Cooking, Storage, Circulation.

    3.  **STEP 3: SANITY CHECK (The "Anti-Clone" Filter)**
        -   Look for suspicious patterns:
            -   Are there multiple rooms with **EXACTLY** the same area (down to the decimal)?
            -   Are there sequential rooms (BDRM 4, BDRM 5) that seem unlikely for this size of home?
        -   **ACTION:** If you find 3+ rooms with *identical* areas and names like "BDRM #3", "BDRM #4", "BDRM #5", assume they are hallucinations/clones. **Count only ONE of them.**

    4.  **STEP 4: AGGREGATE TOTALS**
        -   Sum the area of **ONLY** the unique, Conditioned rooms.
        -   **CRITICAL:** Do NOT include Unconditioned areas in 'totalConditionedFloorArea'.

    OUTPUT: Return the single, complete JSON object.
  `
};