export { debug } from './parsers';
export declare const batch: (...programs: any[]) => {
    mergedQuery: any;
    extractionMaps: any[];
    queryVariableRenames: any;
};
export declare const fetcher: (url: any) => (query: any, args: any) => Promise<any>;
export declare const mux: (getter: any, wait?: number) => (query: any, args: any) => any;
export default mux;
