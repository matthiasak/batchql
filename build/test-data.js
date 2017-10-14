"use strict";
exports.__esModule = true;
exports.queries = [
    "query Person($id: ID!){\n\t\tperson(id: $id){\n\t        name\n\t        email\n\t        createdAt\n\t        updatedAt\n\t\t\tsiblings { name }\n\t\t}\n\t\tnotifications(id: $id){\n\t\t\tsummary\n\t\t\tcreatedAt\n\t\t\ttext\n\t\t}\n\t}",
    "query Person($id: ID!){\n\t\tperson(id: $id){\n\t        name\n\t        email\n\t        createdAt\n\t        updatedAt\n\t\t\tparents\n\t\t\tdetails(id: $id, a: {name: { thing: $id}}){\n\t\t\t\tstuff\n\t\t\t\tmoreStuff\n\t\t\t}\n\t\t}\n\t}",
    "query OtherQuery($id: ID!) {\n\t\tsomeField(uniqueIdentifier: $id){\n\t\t\tname\n\t\t\temail\n\t\t\tcreatedAt\n\t\t\tupdatedAt\n\t\t\tparents {\n\t\t\t\tname\n\t\t\t\tdob\n\t\t\t}\n\t\t}\n\t}"
];
exports.testdata = [
    {
        person: {
            name: "Matty K",
            email: "nacho@bizn.es",
            createdAt: +new Date - 1000 * 60 * 60 * 24,
            updatedAt: +new Date,
            siblings: [
                { name: "Jeremy" },
                { name: "Ian" }
            ]
        },
        notifications: [
            { summary: "test", text: "test" },
            { summary: "test", text: "test" },
            { summary: "test", text: "test" }
        ]
    }
];
