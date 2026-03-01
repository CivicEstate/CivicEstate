import { Phase2Result, UserProfile, GeminiOutput } from '../../types/index'

// TODO: implement Gemini 2.5 Flash analysis
export async function runGeminiAnalysis(
  _phase2Data: Phase2Result,
  _profile: UserProfile
): Promise<GeminiOutput | null> {
  throw new Error('runGeminiAnalysis not yet implemented')
}
