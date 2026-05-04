export interface GenerateClipParams {
  prompt: string
  startImageUrl: string
  durationSeconds: 5 | 10
}

export interface VideoProvider {
  readonly name: string
  generateClip(params: GenerateClipParams): Promise<string> // resolves to download URL
}
