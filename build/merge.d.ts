declare const merge: (...asts: any[]) => {
    mergedQuery: any[];
    queryVariableRenames: any;
    extractionMaps: any[];
};
export default merge;
