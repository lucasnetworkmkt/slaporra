import { GoogleGenAI, GenerateContentResponse, Chat, Part, Content } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

// --- API KEY MANAGEMENT ---

/**
 * CRITICAL CONFIGURATION FOR VERCEL/VITE:
 * 
 * 1. In Vercel Dashboard, go to Settings > Environment Variables.
 * 2. Key Name MUST be: VITE_API_KEY
 * 3. Value: Your Gemini API Key (starts with AIza...)
 * 4. Redeploy after adding the key.
 */
const getPrimaryApiKey = (): string | undefined => {
    try {
        // Safe access to Vite environment variables
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
             // @ts-ignore
             return import.meta.env.VITE_API_KEY;
        }
    } catch (e) {
        console.error("Error accessing env vars", e);
    }
    return undefined;
};

const PRIMARY_KEY = getPrimaryApiKey();

// USING RECOMMENDED MODEL FOR TEXT TASKS
const TEXT_MODEL = "gemini-3-flash-preview";

// --- STATE MANAGEMENT ---

let currentChatSession: Chat | null = null;

// --- FALLBACK LOGIC ---

const createSession = (apiKey: string, history?: Content[]): Chat => {
  const ai = new GoogleGenAI({ apiKey });
  return ai.chats.create({
    model: TEXT_MODEL,
    history: history,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7,
    },
  });
};

const getOrInitSession = (): Chat | null => {
  if (!PRIMARY_KEY) return null;
  
  if (!currentChatSession) {
    currentChatSession = createSession(PRIMARY_KEY);
  }
  return currentChatSession;
};

// --- PUBLIC METHODS ---

export const sendMessageToGemini = async (
  message: string,
  imagePart?: { mimeType: string; data: string }
): Promise<string> => {
  
  if (!PRIMARY_KEY) {
      console.error("Mentor AI: API Key is missing.");
      return "ERRO DE CONFIGURAÇÃO (Vercel): \n\n1. Vá em Settings > Environment Variables no seu projeto Vercel.\n2. Adicione a chave com o nome 'VITE_API_KEY'.\n3. Coloque sua API Key do Google como valor.\n4. Faça um Redeploy.\n\nSem a chave, o Mentor não pode responder.";
  }

  const parts: Part[] = [{ text: message }];
  if (imagePart) {
    parts.unshift({ inlineData: imagePart });
  }

  try {
    const session = getOrInitSession();
    
    if (!session) {
        throw new Error("Não foi possível inicializar a sessão. Verifique a API Key.");
    }

    const response: GenerateContentResponse = await session.sendMessage({ message: parts });
    return response.text || "Erro: Sem resposta do Mentor.";

  } catch (error: any) {
    console.error(`[Mentor AI] Error:`, error);
    
    // Convert error to string safely
    const errStr = error ? error.toString().toLowerCase() : "";

    // Handle Model Not Found (404)
    if (errStr.includes("404") || errStr.includes("not found")) {
        return "ERRO CRÍTICO: Modelo não encontrado. Verifique se sua chave API tem acesso ao 'gemini-3-flash-preview'.";
    }
    
    // Handle Quota/Overload (429/503)
    if (errStr.includes("429")) {
        return "ERRO DE LIMITE (429): Muitas requisições. O plano gratuito tem limites de RPM (Requisições por minuto). Aguarde um momento.";
    }

    if (errStr.includes("503")) {
        return "ERRO DE SERVIDOR (503): O Google Gemini está instável no momento. Tente novamente em 30 segundos.";
    }

    return "ERRO DE SISTEMA: Verifique sua conexão ou a configuração da API Key.";
  }
};

export const generateMindMapText = async (topic: string): Promise<string | null> => {
  
  const prompt = `
    VOCÊ É UM ARQUITETO DE INFORMAÇÃO DO CÓDIGO DA EVOLUÇÃO.
    TAREFA: Crie um MAPA MENTAL ESTRUTURAL em texto sobre: "${topic}".
    
    REGRAS VISUAIS:
    - Use caracteres ASCII/Unicode para conectar (├, └, │, ─).
    - Não use Markdown de código (\`\`\`).
    - O layout deve ser vertical e hierárquico.
    - Estilo limpo, direto e focado em AÇÃO.
    
    EXEMPLO DE SAÍDA:
    
    OBJETIVO CENTRAL
    │
    ├── FASE 1: FUNDAÇÃO
    │   ├── Ação Imediata
    │   └── Bloqueio Mental
    │
    └── FASE 2: EXPANSÃO
        ├── Estratégia
        └── Execução
    
    Gere apenas o mapa. Sem introduções.
  `;

  if (!PRIMARY_KEY) return null;

  try {
      const ai = new GoogleGenAI({ apiKey: PRIMARY_KEY });
      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: { parts: [{ text: prompt }] },
        config: { temperature: 0.5 }
      });
      return response.text || null;
      
    } catch (error) {
      console.warn(`[MindMap AI] Failed.`, error);
      return null;
    }
};