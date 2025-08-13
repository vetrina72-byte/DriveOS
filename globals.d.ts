// This file extends the global Window object to include properties from the Web Speech API,
// which are not standard in all browser typings.

// https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionAlternative
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

// https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionResult
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

// https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionResultList
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

// https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionEvent
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

// https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

// https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;

  start(): void;
  stop(): void;
  abort(): void;

  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

// Interface for the constructor (e.g., `new window.SpeechRecognition()`)
interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}

export {};
