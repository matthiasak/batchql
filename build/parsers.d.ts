export declare const token: (t: any, type: any, d?: number, o?: string, mod?: (x: any) => any) => (s: any) => any;
export declare const ignore: (...args: any[]) => any;
export declare const interleave: (splitter: any, tokenizers: any) => any;
export declare const sequence: (...tokenizers: any[]) => (s: any) => any;
export declare const either: (...tokenizers: any[]) => (s: any) => any;
export declare const maybe: (tokenizer: any) => (s: any) => any;
export declare const readN: (n: any, tokenizer: any) => (s: any) => {
    remaining: any;
    matched: string;
    ast: any[];
};
