import {
  MAINTENANCE_CATEGORIES,
  aiDraftOutputSchema,
  type AiDraftDTO,
  type MaintenanceCategory,
} from '@campus/shared';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export interface GenerateDraftInput {
  audioBuffer?: Buffer;
  audioMimeType?: string;
  buildingName: string;
  roomName: string;
  roomNumber: string;
  mockHintText?: string;
}

const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: {
      type: 'STRING',
      description: 'Short, clear English maintenance ticket title (max 100 chars).',
    },
    description: {
      type: 'STRING',
      description:
        'Concise English description of the issue strictly based on what the voice note states.',
    },
    suggestedCategory: {
      type: 'STRING',
      enum: [...MAINTENANCE_CATEGORIES],
      description: 'Best matching maintenance category from the fixed list.',
    },
    transcript: {
      type: 'STRING',
      description: 'Accurate transcript in the original language/script spoken in the audio.',
    },
  },
  required: ['title', 'description', 'suggestedCategory', 'transcript'],
};

function buildMockDraft(input: GenerateDraftInput): AiDraftDTO {
  const hint = (input.mockHintText ?? '').trim();
  const normalized = hint.toLowerCase();
  const roomLabel = input.roomNumber ? `Room ${input.roomNumber}` : input.roomName;

  let title = `Maintenance issue reported in ${roomLabel}`;
  let description = `Staff reported a maintenance issue at ${input.buildingName}, ${roomLabel}.`;
  let suggestedCategory: MaintenanceCategory = 'Other';
  let transcript =
    hint || `${roomLabel} mein AC se paani tapak raha hai.`;

  if (
    !hint ||
    normalized.includes('ac') ||
    normalized.includes('paani') ||
    normalized.includes('tapak') ||
    normalized.includes('cool') ||
    normalized.includes('hvac')
  ) {
    title = `AC water leakage in ${roomLabel}`;
    description = `Water is dripping from the air conditioning unit in ${roomLabel} (${input.buildingName}).`;
    suggestedCategory = 'HVAC';
    if (!hint) {
      transcript = `${roomLabel} mein AC se paani tapak raha hai.`;
    }
  } else if (
    normalized.includes('pipe') ||
    normalized.includes('tap') ||
    normalized.includes('sink') ||
    normalized.includes('flush') ||
    normalized.includes('leak')
  ) {
    title = `Plumbing leak in ${roomLabel}`;
    description = `A water pipe or plumbing fixture leak was reported in ${roomLabel} (${input.buildingName}).`;
    suggestedCategory = 'Plumbing';
  } else if (
    normalized.includes('light') ||
    normalized.includes('switch') ||
    normalized.includes('fan') ||
    normalized.includes('socket') ||
    normalized.includes('power') ||
    normalized.includes('bijli')
  ) {
    title = `Electrical fault in ${roomLabel}`;
    description = `An electrical issue involving lighting, fan, or power outlet was reported in ${roomLabel} (${input.buildingName}).`;
    suggestedCategory = 'Electrical';
  } else if (
    normalized.includes('chair') ||
    normalized.includes('desk') ||
    normalized.includes('table') ||
    normalized.includes('bench') ||
    normalized.includes('cupboard')
  ) {
    title = `Damaged furniture in ${roomLabel}`;
    description = `Damaged furniture requiring repair was reported in ${roomLabel} (${input.buildingName}).`;
    suggestedCategory = 'Furniture';
  } else if (
    normalized.includes('wall') ||
    normalized.includes('door') ||
    normalized.includes('window') ||
    normalized.includes('ceiling') ||
    normalized.includes('tile') ||
    normalized.includes('crack')
  ) {
    title = `Civil repair needed in ${roomLabel}`;
    description = `A structural, door, window, or wall issue was reported in ${roomLabel} (${input.buildingName}).`;
    suggestedCategory = 'Civil';
  }

  return {
    title,
    description,
    suggestedCategory,
    transcript,
    model: 'mock-ai-v1',
    generatedAt: new Date().toISOString(),
    isMock: true,
  };
}

export async function generateMaintenanceDraft(
  input: GenerateDraftInput
): Promise<AiDraftDTO> {
  if (env.aiMode === 'mock') {
    return buildMockDraft(input);
  }

  if (!env.geminiApiKey) {
    throw new AppError(
      503,
      'AI_UNAVAILABLE',
      'Gemini API key is not configured. Please enter the report details manually.'
    );
  }

  if (!input.audioBuffer || !input.audioMimeType) {
    throw new AppError(
      400,
      'AUDIO_REQUIRED',
      'A recorded voice note is required to generate an AI draft.'
    );
  }

  const prompt = [
    'You are an assistant for a college campus maintenance reporting app.',
    'Listen to the attached short voice note, which may be in Hindi, Hinglish, or English.',
    `Verified campus location selected in the app (source of truth): Building "${input.buildingName}", Room "${input.roomNumber}" (${input.roomName}).`,
    'Rules:',
    '1. Transcribe the voice note accurately in its original language/script in the "transcript" field.',
    '2. Write "title" and "description" in clear, concise English.',
    '3. Describe ONLY what the voice note explicitly supports. Do NOT invent root causes, locations not supported by the app selection, or repair actions.',
    `4. Pick "suggestedCategory" strictly from: ${MAINTENANCE_CATEGORIES.join(', ')}.`,
  ].join('\n');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.geminiModel
  )}:generateContent`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: input.audioMimeType.split(';')[0]?.trim() || 'audio/m4a',
                  data: input.audioBuffer.toString('base64'),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(env.aiTimeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new AppError(
        504,
        'AI_TIMEOUT',
        'Gemini AI request timed out. Please complete the report manually.'
      );
    }
    throw new AppError(
      503,
      'AI_UNAVAILABLE',
      'Could not reach Gemini AI service. Please complete the report manually.'
    );
  }

  if (response.status === 429) {
    throw new AppError(
      429,
      'AI_RATE_LIMITED',
      'Gemini AI quota is temporarily exhausted. Please complete the report manually.'
    );
  }

  if (!response.ok) {
    throw new AppError(
      502,
      'AI_UPSTREAM_ERROR',
      `Gemini AI returned status ${response.status}. Please complete the report manually.`
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new AppError(
      502,
      'AI_EMPTY_RESPONSE',
      'Gemini AI did not return a structured draft. Please complete the report manually.'
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    throw new AppError(
      502,
      'AI_INVALID_JSON',
      'Gemini AI returned malformed JSON. Please complete the report manually.'
    );
  }

  const validated = aiDraftOutputSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new AppError(
      502,
      'AI_INVALID_SCHEMA',
      'Gemini AI response did not match the required report schema. Please complete the report manually.'
    );
  }

  return {
    ...validated.data,
    model: env.geminiModel,
    generatedAt: new Date().toISOString(),
    isMock: false,
  };
}
