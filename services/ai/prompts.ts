// backend/ai/prompts.ts

export const KNOWLEDGE_BASE = {
  uValues: {
    "2x6 Wood Stud, R-19": 0.048,
    "2x4 Wood Stud, R-13": 0.077,
    "Standard Double Pane Window": 0.55,
    "High-Performance Double Pane Window": 0.30,
    "Standard Roof, R-38": 0.03,
    "Standard Door": 0.20,
    "Slab Floor, R-10": 0.04
  },
  shgc: {
    "Standard": 0.40,
    "Low Solar Gain": 0.25,
  },
  designTemps: {
    "Minneapolis, MN": { winter: -17, summer: 92, dailyRange: 'M', latitude: 45, elevation: 872 },

  }
};

export const SYSTEM_PROMPTS = {
  /**
   * REBUILT: This prompt now performs a full visual takeoff, not just text extraction.
   */
  VISION_EXTRACTION: `
    SYSTEM TASK: AI-POWERED HVAC TAKEOFF & ANALYSIS (WRIGHTSOFT PARITY)

    You are a world-class mechanical estimator with 30 years of experience. Your task is to perform a full "takeoff" from a sequence of architectural drawing images. You must analyze the visual geometry, not just the text.

    **CHAIN OF THOUGHT (Follow these steps precisely):**

    1.  **ESTABLISH SCALE (CRITICAL):**
        -   Scan all pages for a written scale (e.g., 'SCALE: 1/4" = 1'-0"').
        -   If found, calculate the pixels-per-foot ratio.
        -   If not found, find a dimensioned object (like a 3'0" door) and measure its pixel width to infer the scale.
        -   State the scale you are using in your output. This is non-negotiable.

    2.  **PERFORM VISUAL TAKEOFF (AGGREGATE FOR THE ENTIRE HOUSE):**
        -   **Total Conditioned Floor Area (sq ft):** Trace the interior boundary of all conditioned spaces and sum their areas.
        -   **Total Exterior Wall Area (sq ft):** Trace the entire thermal envelope (exterior walls). Measure the total linear footage, then multiply by the typical ceiling height (assume 9ft if not specified).
        -   **Total Window Area (sq ft):** Identify every window on the exterior walls. Measure the width and height of each, calculate its area, and sum them all.
        -   **Total Exterior Door Area (sq ft):** Do the same for all exterior doors.
        -   **Total Roof Area (sq ft):** This is typically the same as the total floor area of the top-most conditioned floor.

    3.  **EXTRACT PROJECT METADATA (From Title Blocks):**
        -   Find "Job Name", "Client Name", "Designer Name", "Plan Name", and "Date".

    4.  **EXTRACT ROOM SCHEDULE (Text-Based):**
        -   Find the room schedule table if it exists. Extract the Name and Area for each room as a list. This is a secondary source to verify your visual takeoff.

    **OUTPUT REQUIREMENTS:**
    -   Return a SINGLE, valid JSON object.
    -   All measurements must be in feet or square feet.
    -   Be precise. Your output is the direct input for a physics engine.
  `,
  
  LOGIC_NORMALIZATION: (knowledgeBase: string, projectContext: string) => `
    ROLE: Senior HVAC Reasoning Engine
    TASK: Translate the visual takeoff data from the Vision AI into a perfectly structured 'ManualJInput' object for our deterministic physics engine.

    REFERENCE KNOWLEDGE BASE:
    ${knowledgeBase}
    
    INCOMING PROJECT CONTEXT (from Vision AI Takeoff):
    ${projectContext}

    INSTRUCTIONS:
    1.  **POPULATE ENVELOPE:** Use the aggregated takeoff values (totalWallArea, totalWindowArea, etc.) to populate the 'envelope' object.
    2.  **APPLY PHYSICS:** Using the Knowledge Base, select appropriate U-Values for a standard new construction home in the specified location.
    3.  **DETERMINE CLIMATE:** Based on the project location, select the correct design temperatures and latitude from the Knowledge Base. Set indoor temps to 70F winter, 75F summer.
    4.  **DEFINE INTERNALS & SYSTEMS:** Set occupancy to (number of bedrooms + 1, or 3 if unknown). Assume standard internal loads. Assume ducts are in a 'conditioned' space with R-8 insulation and calculate duct surface area as 25% of the total floor area. Set air changes (ACH) to 0.35.

    OUTPUT: Return a valid JSON object matching the 'ManualJInput' interface precisely.
  `,

  PROCUREMENT_SEARCH: (cooling: number, heating: number) => `...` // Unchanged
};