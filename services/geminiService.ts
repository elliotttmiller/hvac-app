
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * PHASE 1: Multi-Sheet Vision Transcription
 * Analyzes multiple architectural sheets to extract a unified room schedule.
 */
export const extractBlueprintData = async (imageParts: { data: string, mimeType: string }[]): Promise<string> => {
  const parts = imageParts.map(p => ({
    inlineData: { mimeType: p.mimeType, data: p.data }
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        ...parts,
        { text: `SYSTEM TASK: MULTI-SHEET ARCHITECTURAL TRANSCRIPTION. 
        You are looking at a sequence of architectural drawings (blueprints). 
        
        INSTRUCTIONS:
        1. Traverse EVERY sheet provided.
        2. Extract a comprehensive room schedule.
        3. If a room appears on multiple sheets, reconcile the dimensions into a single entry.
        4. Focus on Net Floor Area, Exterior Wall Length, and Window Glazing Area.
        5. Return a unified JSON list of rooms.` }
      ]
    },
    config: {
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rooms: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                area: { type: Type.NUMBER },
                exteriorWallLength: { type: Type.NUMBER },
                windowsArea: { type: Type.NUMBER },
                wallType: { type: Type.STRING },
                confidence: { type: Type.STRING }
              }
            }
          },
          totalPagesAnalyzed: { type: Type.NUMBER },
          inferredScale: { type: Type.STRING }
        }
      }
    }
  });
  return response.text || "{}";
};

/**
 * PHASE 2: Logic Normalization for Physics Engine
 * Translates architectural text into physical U-Values and SHGC.
 */
export const prepareManualJInput = async (projectData: any): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `ROLE: Senior HVAC Reasoning Engine.
    TASK: Translate architectural project data into a physical input object for our deterministic math engine.
    
    PROJECT CONTEXT: ${JSON.stringify(projectData)}

    ASSIGN PHYSICAL VALUES:
    1. Determine wallUValue based on wallType (e.g. 2x6 Wood Stud = 0.048).
    2. Determine windowUValue (Standard Double Pane = 0.55).
    3. Determine windowSHGC (Standard = 0.40).
    4. Map Climate orientation ('north','south','east','west','mixed') and humidity grain ratio for ${projectData.location.city}.
    5. Set standard indoor design temperatures (70F winter, 75F summer).

    Return a valid JSON object matching the ManualJInput interface structure precisely.` ,
    config: { 
      thinkingConfig: { thinkingBudget: 1500 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        required: ["climate", "physics", "internals", "envelope"],
        properties: {
          climate: {
            type: Type.OBJECT,
            properties: {
              outdoorTempWinter: { type: Type.NUMBER },
              outdoorTempSummer: { type: Type.NUMBER },
              indoorTempWinter: { type: Type.NUMBER },
              indoorTempSummer: { type: Type.NUMBER },
              humidityRatio: { type: Type.NUMBER },
              orientation: { type: Type.STRING }
            }
          },
          physics: {
            type: Type.OBJECT,
            properties: {
              wallUValue: { type: Type.NUMBER },
              windowUValue: { type: Type.NUMBER },
              windowSHGC: { type: Type.NUMBER },
              doorUValue: { type: Type.NUMBER },
              roofUValue: { type: Type.NUMBER },
              floorUValue: { type: Type.NUMBER },
              airChanges: { type: Type.NUMBER },
              ventilationCFM: { type: Type.NUMBER }
            }
          },
          internals: {
            type: Type.OBJECT,
            properties: {
              occupancy: { type: Type.NUMBER },
              applianceLoadWatts: { type: Type.NUMBER },
              lightingLoadWatts: { type: Type.NUMBER }
            }
          },
          envelope: {
            type: Type.OBJECT,
            properties: {
              foundationType: { type: Type.STRING, description: "slab, basement, or crawlspace" }
            }
          }
        }
      }
    }
  });
  return response.text || "{}";
};

// Original AI Calc function for legacy/fallback purposes
export const calculateManualJ = async (projectData: any): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Calculate loads for: ${JSON.stringify(projectData.rooms)}`,
    config: { responseMimeType: 'application/json' }
  });
  return response.text || "{}";
};

/**
 * PHASE 3: Procurement Sourcing
 */
export const fetchEquipmentScenarios = async (totalCooling: number, totalHeating: number): Promise<{text: string, sources: any[]}> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Search for exactly 3 HVAC systems (Air Conditioners or Heat Pumps) that meet a requirement of approximately ${totalCooling} BTU Cooling and ${totalHeating} BTU Heating. 
    Find real manufacturer models (e.g. Carrier, Trane, Lennox, Rheem). 
    Ensure they are SEER2 compliant. 
    Provide one VALUE option, one EFFICIENCY option, and one PREMIUM option.
    Return ONLY a JSON array.`,
    config: { 
      tools: [{googleSearch: {}}],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          required: ["label", "modelNumber", "manufacturer", "seer2", "hspf2", "capacityBtuh", "estimatedPrice", "roiYears", "pros", "compliance"],
          properties: {
            label: { type: Type.STRING, description: "Must be exactly 'VALUE', 'EFFICIENCY', or 'PREMIUM'" },
            modelNumber: { type: Type.STRING },
            manufacturer: { type: Type.STRING },
            seer2: { type: Type.NUMBER },
            hspf2: { type: Type.NUMBER },
            capacityBtuh: { type: Type.NUMBER },
            estimatedPrice: { type: Type.NUMBER },
            roiYears: { type: Type.NUMBER },
            pros: { type: Type.ARRAY, items: { type: Type.STRING } },
            compliance: {
              type: Type.OBJECT,
              properties: {
                manualS: { type: Type.BOOLEAN },
                localCode: { type: Type.BOOLEAN }
              }
            }
          }
        }
      }
    }
  });
  return { 
    text: response.text || "[]", 
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] 
  };
};
