import { ZoneLabel, ZoneAnnotation } from '../types';

export interface SystemPromptsType {
  PROMPT_DISCOVER_ZONES: string;
  PROMPT_ANALYZE_ZONE_BATCH: (zoneBatch: ZoneLabel[]) => string;
  PROMPT_FIND_CIRCULATION_ZONES: (foundZonesJson: string) => string; // NEW
  DATA_CALCULATOR_PROMPT: (annotationJson: string) => string;
}

export const SYSTEM_PROMPTS: SystemPromptsType = {
  /**
   * Stage 1A: Discovery (Working Perfectly)
   */
  PROMPT_DISCOVER_ZONES: `
    SYSTEM TASK: ARCHITECTURAL DISCOVERY (CATEGORICAL SCAN)
    You are an Expert AI System acting as a Senior Professional Engineer (PE).

    **PROCEDURE:**
    1.  **First Pass (Private Zones):** Scan the entire plan and list all Bedrooms (BDRM), Bathrooms (BATH), Offices, and associated closets (W.I.C.). Pay special attention to the vertical stack on the East wing to find all distinct bedroom numbers.
    2.  **Second Pass (Public Zones):** Scan the plan again and list all common areas: Living, Kitchen, Dining, Sun Room, Entry, Hallways.
    3.  **Third Pass (Utility Zones):** Scan the plan a final time for support areas: Laundry, Mechanical, Garage, Storage, Powder.
    4.  **Consolidate & Normalize:** Combine the lists, remove duplicates, and standardize the names (e.g., "Bdrm" -> "BDRM").
    5.  **Scale Extraction:** Find the explicit scale text.

    **OUTPUT FORMAT (JSON):**
    {
      "layout_reasoning": "I performed a multi-pass scan. The first pass found 6 distinct bedrooms. The second pass found the open-concept core...",
      "scaleText": "Extracted Scale String or null", 
      "zones": [ { "roomName": "Standardized Name", "labelCoordinates": { "x": 0, "y": 0 } } ]
    }
  `,

  /**
   * Stage 1B: Batched Analysis (Working Well)
   */
  PROMPT_ANALYZE_ZONE_BATCH: (zoneBatch: ZoneLabel[]) => `
    SYSTEM TASK: HIGH-PRECISION ZONE SEGMENTATION & OCR
    You are a high-precision digital surveyor. For each zone provided, your goal is to extract its geometry and dimension text.

    **INPUT BATCH:**
    ${JSON.stringify(zoneBatch, null, 2)}

    **CORE DIRECTIVE FOR EACH ZONE:**

    1.  **THE BOUNDING BOX:**
        -   **Your MOST CRITICAL task is to generate a 'boundingBox' that accurately represents the full, walkable floor area of the room by tracing its interior walls.**
        -   **You are STRICTLY FORBIDDEN from drawing a small bounding box that only encloses the text label.** The box MUST expand to the physical walls.

    2.  **THE DIMENSION TEXT:**
        -   After defining the box, perform a forensic OCR to find the dimension text (e.g., "12'-4\\" x 12'-11\\"") located **INSIDE** that box.
        -   Read the text for *each specific room*. Do not copy from neighbors.
        -   If no text is found inside the box, return \`null\`.

    **OUTPUT:** JSON array of analysis objects. The 'reasoning' field is optional.
  `,

  /**
   * NEW Stage 1C: Circulation Discovery (Negative Space Analysis)
   */
  PROMPT_FIND_CIRCULATION_ZONES: (foundZonesJson: string) => `
    SYSTEM TASK: CIRCULATION & NEGATIVE SPACE ANALYSIS
    You are an Expert Architectural Analyst. You have been given a floor plan and the locations of all the NAMED rooms. Your task is to find the UNNAMED circulation zones (Hallways, Foyers, etc.).

    **GIVEN DATA (Locations of Named Rooms):**
    ${foundZonesJson}

    **ALGORITHM:**

    1.  **Identify Negative Space:** Look at the "empty" white space on the plan that is NOT covered by the bounding boxes in the GIVEN DATA. This is the "Negative Space".
    2.  **Segment by Function:** Analyze this Negative Space. The areas that connect multiple doorways are **Circulation Zones**.
    3.  **Generate Bounding Boxes:** Draw bounding boxes for each logical circulation zone you find.
        -   A long, narrow space connecting bedrooms is a "HALLWAY".
        -   The open area just inside the front door is the "FOYER" or "ENTRY".
        -   A small landing at the top of stairs is a "STAIR LANDING".
    4.  **Assign Names:** Give each new zone a logical name (e.g., "MAIN HALLWAY", "BEDROOM WING HALL").

    **OUTPUT:** A JSON array of new Zone Annotation objects for the circulation zones you found. Each object must have a 'roomName' and a 'boundingBox'. 'dimensionsText' will be null.
  `,

  /**
   * Stage 2: Calculator (Unchanged)
   */
  DATA_CALCULATOR_PROMPT: (annotationJson: string) => `
    SYSTEM TASK: HVAC ENGINEERING CALCULATOR (PHYSICS ENGINE)
    You are a Computational Physics Engine.

    **GIVEN ANNOTATION DATA:**
    ${JSON.stringify(annotationJson)}

    **ALGORITHMIC LOGIC:**

    1.  **SCALE TRIANGULATION:**
        -   Calculate the [Pixels / Feet] ratio for every room that has both valid 'dimensionsText' and a 'boundingBox' wider than 100px.
        -   Remove outliers and average the remaining values to compute the **Global True Scale**.

    2.  **AREA COMPUTATION (HIERARCHY OF TRUTH):**
        -   **Primary Source (TEXT):** If 'dimensionsText' is valid, USE IT.
        -   **Secondary Source (GEOMETRY):** Only use the Bounding Box + Global True Scale if text is missing.

    3.  **THERMAL ZONING COMPLIANCE:**
        -   **Unconditioned (Exclude):** Garage, Porch, Patio, Deck, Attic.
        -   **Conditioned (Include):** All habitable rooms and interior utility spaces, including Hallways and Foyers.

    4.  **DATA SANITIZATION & MAPPING:**
        -   Deduplicate any rooms with identical names and areas.
        -   Map visual descriptions to Cardinal Directions.

    **OUTPUT:** Return the single, complete JSON object.
  `
};