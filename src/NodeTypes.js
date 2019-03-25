import React from 'react'

import { GraphState, PropertyState } from "./NodeState"


const PropertyTypes = {
	Label: {
		defaultWidth: 0,
		create: name => PropertyState.create("Label", name, null), 
		render: () => null,
	},

	Characters: {
		defaultWidth: 60,
		create: (name, characters) => PropertyState.create("Characters", name, characters), 
		render: props => <input 
			className="input"
			type="text" value={props.value} 
			onChange = { event => props.onChange(event.target.value) }
			onMouseDown = {e => { if (e.button == 0) e.stopPropagation(); else e.preventDefault() }}
			onClick = {e => e.stopPropagation()}
			onKeyPress = {e => e.stopPropagation()}
		/>
	},

	Character: {
		defaultWidth: 30,
		create: (name, character) => PropertyState.create("Character", name, character), 
		render: props => <input 
			className="character input"
			type="text" value={props.value} 
			onChange = { event => props.onChange(event.target.value) }
			onMouseDown = {e => { if (e.button == 0) e.stopPropagation(); else e.preventDefault() }}
			onClick = {e => e.stopPropagation()}
			onKeyPress = {e => e.stopPropagation()}
		></input>
	},

	Node: {
		defaultWidth: 0,
		create: (name, duplicateOnConnect) => PropertyState.create("Node", name, null, duplicateOnConnect), 
		render: () => null, // rendered as svg lines earlier
	},

	Bool: {
		defaultWidth: 30,
		create: (name, checked) => PropertyState.create("Bool", name, checked), 
		render: props => <input 
			className="input"
			type="checkbox" checked={props.value} onChange={e => props.onChange(e.target.checked)}
			onMouseDown = {e => { if (e.button == 0) e.stopPropagation(); else e.preventDefault() }}
			onClick = {e => e.stopPropagation()}
			onKeyPress = {e => e.stopPropagation()}
		/> 
	},

	Number: {
		defaultWidth: 30,
		create: (name, value) => PropertyState.create("Number", name, value), 
		render: props => <input
			className="input"
			type="number" value={props.value} 
			onChange = { event => props.onChange(event.target.value) }
			onMouseDown = {e => { if (e.button == 0) e.stopPropagation(); else e.preventDefault() }}
			onClick = {e => e.stopPropagation()}
			onKeyPress = {e => e.stopPropagation()}
		/>
	},
}


const literalRegexNodeType = (name, regex, generator) => ({
	precedence: 5,
	defaultProperties: () => [ PropertyTypes.Label.create(name) ],
	build: () => regex,
	generate: generator || ((_, random) => findCharacter(random, regex)),
})

const literalCharacterNodeType = (name, regex, char) => ({
	precedence: 5,
	defaultProperties: () => [ PropertyTypes.Label.create(name) ],
	build: () => regex,
	generate: () => char,
})

const buildPropertyInput = (property, graph) => GraphState.build(property.value, graph,)
const generatePropertyInput = (property, random, graph) => GraphState.generate(property.value, random, graph)

// put parantheses around arguments which have stronger precedence than ourselves
const buildInputWithPrecedence = (ownPrecedence, input, graph) => {
	if (input.value == null) return buildPropertyInput(input, graph)

	const node = graph.nodes[input.value]
	const inputPrecedence = NodeTypes[node.type].precedence

	const rawInput = buildPropertyInput(input, graph)
	if (inputPrecedence >= ownPrecedence) return rawInput
	else return "(?:" + rawInput + ")"
}

// operators group their operands, nothing is grouping itself
const NodeTypes = {
	"Expression Result": {
		precedence: 0,
		defaultProperties: () => [
			PropertyTypes.Node.create("Expression Result"), // same name as node itself will collapse
			PropertyTypes.Bool.create("Multiple Matches", true),
			PropertyTypes.Bool.create("Case-Sensitive", true),
			PropertyTypes.Bool.create("Multiline", true),
			// TODO: u, s (for es2018)
		],

		build: (properties, graph) => {
			let result = "/" + buildPropertyInput(properties[0], graph) + "/"
			if (properties[1].value) result += "g"
			if (!properties[2].value) result += "i"
			if (properties[3].value) result += "m"
			return result
		},

		generate: (properties, random, graph) => {
			// TODO customize generated input according to flags 
			return generatePropertyInput(properties[0], random, graph)
		},
	},

	"Not Digit": literalRegexNodeType("Not Digit", "\\D"),
	"Word Char": literalRegexNodeType("Word Char","\\w"), // includes asian glyphs
	"Not Word Char": literalRegexNodeType("Not Word Char","\\W"),
	"Word Boundary": literalRegexNodeType("Word Boundary","\\b", () => " word"), // TODO
	"Not Word Boundary": literalRegexNodeType("Not Word Boundary","\\b", () => "word"), // TODO
	"Digit": literalRegexNodeType("Digit","\\d", (_properties, random) => random.upto(10)), // TODO ,-.? 

	"Whitespace Char": literalRegexNodeType("Whitespace Char","\\s", (_properties, random) => random.select([
		" ", "\t", "\r", "\n", "\v", "\f" 
		// TODO ​\u00A0\u1680​\u180e\u2000​\u2001\u2002​\u2003\u2004​ \u2005\u2006​\u2007\u2008​\u2009\u200a​\u2028\u2029​\u2028\u2029​ \u202f\u205f​\u3000
	])),

	"Not Whitespace Char": literalRegexNodeType("Not Whitespace Char","\\S"),

	"Not Linebreak": literalRegexNodeType("Not Linebreak", "."),
	"Linebreak": literalCharacterNodeType("Linebreak","\\n", "\n"),
	"Tab": literalCharacterNodeType("Tab","\\t", "\t"), 

	// TODO \p{} es2018

	"Never": literalRegexNodeType("Never", "(?!)", () => ""),
	"Any": literalRegexNodeType("Any", "(?:)"),

	"Literal": {
		precedence: 2, // TODO is atomic(precedence 5) if contains only a single char
		defaultProperties: () => [ PropertyTypes.Characters.create("Literal", "the") ],
		build: properties => escapeInput(properties[0]),
		generate: properties => properties[0].value,
	},

	"Any of Chars": {
		precedence: 5,
		defaultProperties: () => [ PropertyTypes.Characters.create("Any of Chars", ":!?.,") ],
		build: properties => "[" + escapeCharsInBracket(properties[0].value) + "]",  // TODO deduplicate
		generate: (properties, random) => random.select(properties[0].value)
	},

	"None of Chars": {
		precedence: 5,
		defaultProperties: () => [ PropertyTypes.Characters.create("None of Chars", ":!?.,") ],
		build: properties => "[^" + escapeCharsInBracket(properties[0].value) + "]",  // TODO deduplicate
		generate: (properties, random) => findCharacter(random, "[^" + escapeCharsInBracket(properties[0].value) + "]"),
	},

	"Char Range": {
		precedence: 5,
		defaultProperties: () => [
			PropertyTypes.Label.create("Char Range"),
			PropertyTypes.Character.create("Start", "a"), 
			PropertyTypes.Character.create("End", "z") 
		],
		build: properties => "[" + escapeCharacter(properties[0]) + "-" + escapeCharacter(properties[1]) + "]",
		generate: (properties, random) => {
			const start = properties[0].value.charCodeAt(0)
			const end = properties[1].value.charCodeAt(0)
			const charCode = random.range(start, end + 1)
			return String.fromCharCode(charCode)
		},
	},

	"Not in Char Range": {
		precedence: 5,
		defaultProperties: () => [ 
			PropertyTypes.Label.create("Not in Char Range"),
			PropertyTypes.Character.create("Start", "A"), 
			PropertyTypes.Character.create("End", "Z") 
		],
		build: properties => "[^" + escapeCharacter(properties[0]) + "-" + escapeCharacter(properties[1]) + "]",
		generate: (properties, random) => findCharacter(random, "[^" + escapeCharacter(properties[0]) + "-" + escapeCharacter(properties[1]) + "]"),
	},


	"Any Of": {
		precedence: 1,
		defaultProperties: () => [
			PropertyTypes.Label.create("Any Of"),
			PropertyTypes.Node.create("Option", true),
		], 
		build: (properties, graph) => {
			const connected = properties.filter(p => p.value != null)
			if (!connected.length) return NodeTypes["Never"].build()
			else return connected.map(e => buildInputWithPrecedence(1, e, graph)).join("|")
		},
		generate: (properties, random, graph) => {
			const connected = properties.filter(p => p.value != null)
			if (!connected.length) return NodeTypes["Never"].generate() 
			else return GraphState.generate(random.select(connected).value, random, graph)
		}
	},

	"Sequence": {
		precedence: 2,
		defaultProperties: () => [
			PropertyTypes.Label.create("Sequence"),
			PropertyTypes.Node.create("Next", true),
		],
		build: (properties, graph) => {
			const connected = properties.filter(p => p.value != null)
			if (!connected.length) return NodeTypes["Never"].build()
			else return connected.map(e => buildInputWithPrecedence(2, e, graph)).join("")
		},
		generate: (properties, random, graph) => {
			const connected = properties.filter(p => p.value != null)
			if (!connected.length) return NodeTypes["Never"].generate(null, random)
			else return connected.map(e => generatePropertyInput(e, random, graph)).join("")
		},
	},

	"Capture": {
		precedence: 5,
		defaultProperties: () => [
			PropertyTypes.Node.create("Capture"),
		],
		build: (properties, graph) => "(" + buildPropertyInput(properties[0], graph) + ")",
		generate: (properties, random, graph) => generatePropertyInput(properties[0], random, graph),
	},

	"Optional": {
		precedence: 4,
		defaultProperties: () => [  
			PropertyTypes.Node.create("Optional"),
		],
		build: (properties, graph) => buildInputWithPrecedence(4, properties[0], graph) + "?",
		generate: (properties, random, graph) => {
			if (random.chance(0.6)) return ""
			else return generatePropertyInput(properties[0], random, graph)
		},
	},

	"At Least One": {
		precedence: 4,
		defaultProperties: () => [
			PropertyTypes.Node.create("At Least One"),
			PropertyTypes.Bool.create("Lazy", false),
		],
		build: (properties, graph) => buildInputWithPrecedence(4, properties[0], graph) + "+" + (properties[1].value? "?" : ""),
		generate: (properties, random, graph) => {
			let result = generatePropertyInput(properties[0], random, graph)
			while(random.chance(0.7)) result += generatePropertyInput(properties[0], random, graph)
			return result
		},
	},

	"Any Repetition": {
		precedence: 4,
		defaultProperties: () => [
			PropertyTypes.Node.create("Any Repetition"),
			PropertyTypes.Bool.create("Lazy", false),
		],
		build: (properties, graph) => buildInputWithPrecedence(4, properties[0], graph) + "*" + (properties[1].value? "?" : ""),
		generate: (properties, random, graph) => {
			let result = ""
			while(random.chance(0.5)) // TODO greedy?
				result += generatePropertyInput(properties[0], random, graph)
			return result
		},
	},

	"Exact Repetition": {
		precedence: 4,
		defaultProperties: () => [
			PropertyTypes.Node.create("Exact Repetition"),
			PropertyTypes.Number.create("Count", 3),
		],
		build: (properties, graph) => buildInputWithPrecedence(4, properties[0], graph) + "{" + properties[1].value + "}",
		generate: (properties, random, graph) => {
			let result = ""
			for (let i = 0; i < properties[1].value; i++)
				result += generatePropertyInput(properties[0], random, graph)

			return result
		},
	},

	"Ranged Repetition": {
		precedence: 4,
		defaultProperties: () => [
			PropertyTypes.Node.create("Ranged Repetition"),
			PropertyTypes.Number.create("Minimum", 2),
			PropertyTypes.Number.create("Maximum", 3),
			PropertyTypes.Bool.create("Minimal", false),
		],
		build: (properties, graph) => buildInputWithPrecedence(4, properties[0], graph) + "{" + properties[1].value + "," + properties[2].value + "}" + (properties[3].value? "?" : ""),
		generate: (properties, random, graph) => {
			const count = random.range(properties[1].value, properties[2].value + 1)
			let result = ""

			// FIXME escalates quickly

			// TODO minimum
			for (let i = 0; i < count; i++)
				result += generatePropertyInput(properties[0], random, graph)

			return result
		},
	},

	/*"Minimum Repetition": {
		build: (node, graph) => buildInput(node, graph.element) + "{" + node.count + ",}",
	},*/

	"If At End": {
		precedence: 3, // TODO
		defaultProperties: () => [
			PropertyTypes.Node.create("If At End"),
		],
		build: (properties, graph) => buildInputWithPrecedence(3, properties[0], graph) + "$",

		// TODO would need to check globally
		generate: (properties, random, graph) => generatePropertyInput(properties[0], random, graph), 
	},

	"If At Start": {
		precedence: 3, // TODO
		defaultProperties: () => [
			PropertyTypes.Node.create("If At Start"),
		],
		build: (properties, graph) => "^" + buildInputWithPrecedence(3, properties[0], graph),

		// TODO would need to check globally
		generate: (properties, random, graph) => generatePropertyInput(properties[0], random, graph), // TODO add random chars
	},

	"If Followed By": {
		precedence: 3,
		defaultProperties: () => [
			PropertyTypes.Node.create("If Followed By"),
			PropertyTypes.Node.create("Successor"),
		],
		build: (properties, graph) => buildInputWithPrecedence(3, properties[0], graph) + "(?=" + buildPropertyInput(properties[1], graph) + ")",
		generate: (properties, random, graph) => generatePropertyInput(properties[0], random, graph) + generatePropertyInput(properties[1], random, graph),
	},

	"If Not Followed By": {
		precedence: 3,
		defaultProperties: () => [ 
			PropertyTypes.Node.create("If Not Followed By"),
			PropertyTypes.Node.create("Successor"),
		],
		build: (properties, graph) => buildInputWithPrecedence(3, properties[0], graph) + "(?!" + buildPropertyInput(properties[1], graph) + ")",
		generate: (properties, random, graph) => generatePropertyInput(properties[0], random, graph), // TODO
	}
}



// TODO use operator precedence
// TODO explicit output?

const escapeInput = input => escapeCharacters(input.value)
const escapeCharacter = input => escapeCharacters(input.value[0])
const escapeCharacters = chars => {
	// TODO use a regex
	const needsBackslash = "[]{}()|^.-+*?!$/\\"
	let result = ""

	for (let char of chars){
		if (needsBackslash.includes(char))
			result += "\\"

		result += char
	}

	return result
}

const escapeCharsInBracket = chars => {
	// TODO use a regex
	const needsBackslash = ".[]^-\\"
	let result = ""

	for (let char of chars){
		if (needsBackslash.includes(char))
			result += "\\"

		result += char
	}

	return result
}

const findCharacter = (random, regexSource) => {
	const regex = new RegExp(regexSource)
	const notStrangeWhitespace = /[ \t\S]/

	while (true){
		// favor simple ascii letters a percentage of 90%
		if (random.chance(0.9)){
			const char = String.fromCharCode(random.upto(256)) 
			if (regex.test(char) && notStrangeWhitespace.test(char)) 
				return char
		}
		
		else { // spice things up with some really unexpected characters
			const char = String.fromCharCode(random.upto(65000)) 
			if (regex.test(char) && notStrangeWhitespace.test(char)) 
				return char
		}
	}
}

/*const randomRange = (min, max) => Math.floor(min + Math.random() * (max - min))
const selectRandom = choice => choice[Math.floor(Math.random() * choice.length)]*/



export { NodeTypes, PropertyTypes }