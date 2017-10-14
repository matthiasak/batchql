export const queries = [
	`query Person($id: ID!){
		person(id: $id){
	        name
	        email
	        createdAt
	        updatedAt
			siblings { name }
		}
		notifications(id: $id){
			summary
			createdAt
			text
		}
	}`,
	`query Person($id: ID!){
		person(id: $id){
	        name
	        email
	        createdAt
	        updatedAt
			parents
			details(id: $id, a: {name: { thing: $id}}){
				stuff
				moreStuff
			}
		}
	}`,
	`query OtherQuery($id: ID!) {
		someField(uniqueIdentifier: $id){
			name
			email
			createdAt
			updatedAt
			parents {
				name
				dob
			}
		}
	}`
]

export const testdata = [
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
            {summary: "test", text: "test"},
            {summary: "test", text: "test"},
            {summary: "test", text: "test"}
        ]
    }
]