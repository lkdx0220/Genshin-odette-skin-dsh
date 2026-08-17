/**
 * Minimal ambient declarations for @deepseek-ai/cordis.
 * The deployed cordis package ships empty lib/types, so we declare only the
 * surface this plugin touches. Runtime resolution is handled by the DSH loader.
 */
declare module '@deepseek-ai/cordis' {
  export interface Context {
    [key: string]: any
    name?: string
    logger?: {
      info?: (...args: any[]) => void
      warn?: (...args: any[]) => void
      error?: (...args: any[]) => void
    }
  }

  export class Service<T = any> {
    [key: string]: any
  }
}
