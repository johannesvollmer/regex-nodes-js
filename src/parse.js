import { NodeState } from "./NodeState";

// TODO not working: [abc]\s?

const parse = string => {
	if (string == null || !string.length)
		return []

	else return parseExpressionResult(string)
}


const parseExpressionResult = string => {
	if (string.startsWith("/")){
		const findFlags = /(?:\/[igm]{0,3})$/i
		const match = string.match(findFlags)

		if (match) {
			const expression = string.slice(1, match.index) // 1: skip first '/'
			const flags = match[0]

			const multipleMatches = (/g/i).test(flags)
			const caseSensitive = !(/i/i).test(flags)
			const multiline = (/m/i).test(flags)

			return NodeState.createWithInputValues({x:0, y:0}, "Expression Result", [
				parseAlternation(expression).node,
				multipleMatches,
				caseSensitive,
				multiline
			])
		}
		else return parseAlternation(string).node
	}

	return parseAlternation(string).node
}

const parseAlternation = (string, predicate) => {
	const endSequence = remaining => !/^[\|\]\)]/.test(remaining)
	const first = parseSequence(string, endSequence)
	string = first.remaining

	if (!first.node)
		return first

	const options = [first.node]

	while (string.length && string.startsWith("|") && (!predicate || predicate(string))){ 
		string = string.slice(1) // skip "|"

		const sequence = parseSequence(string, endSequence) // TODO consumes closing ')'?
		options.push(sequence.node)
		string = sequence.remaining
	}

	if (options.length == 1) return { node: options[0], remaining: string }
	else return { node: NodeState.createWithInputValues({x:0, y:0}, "Any Of", options), remaining: string }
}

const parseSequence = (string, predicate) => {
	const members = []

	while(string.length && predicate(string)){
		const member = parsePositioned(string)
		members.push(member.node)
		string = member.remaining
	}
	
	// collapse subsequential literals into single literal
	const simplified = []
	for(let member of members){
		const last = simplified.length && simplified[simplified.length - 1]
		if (last && member.type == "Literal" && last.type == "Literal")
			last.properties[0].value += member.properties[0].value

		else simplified.push(member)
	}

	if (simplified.length == 1) return { node: simplified[0], remaining: string }
	else return { node: NodeState.createWithInputValues({x:0, y:0}, "Sequence", simplified), remaining: string }
}

const parsePositioned = string => {
	return parseLookahead(string)
} 

const parseLookahead = string => {
	return parseQuantified(string)
} 

const parseQuantified = string => {
	const atom = parseAtom(string)
	string = atom.remaining

	if (atom.node == null)
		return atom
	
	if (string.startsWith("?")) return { 
		node: NodeState.createWithInputValues({x:0, y:0}, "Optional", [atom.node]), 
		remaining: string.slice(1) 
	}

	const minimal = string => {
		if (string.startsWith("?")) return {
			value: true, remaining: string.slice(1)
		}
		else return { 
			value: false, remaining: string 
		}
	}
	

	if (string.startsWith("*")) {
		const isMinimal = minimal(string.slice(1))
		return { 
			remaining: isMinimal.remaining,
			node: NodeState.createWithInputValues({x:0, y:0}, "Any Repetition", [
				atom.node, isMinimal.value
			]), 
		}
	}
	else if (string.startsWith("+")) {
		const isMinimal = minimal(string.slice(1))
		return { 
			remaining: isMinimal.remaining,
			node: NodeState.createWithInputValues({x:0, y:0}, "At Least One", [
				atom.node, isMinimal.value
			]), 
		} 
	}
	else if (string.startsWith("{")){
		string = string.slice(1)
		const closing = string.indexOf("}") // TODO error check
		const range = string.slice(0, closing)
		const remaining = string.slice(closing + 1) // skip '}'
		const limits = range.split(",")

		if (limits.length == 1) return { 
			remaining,
			node: NodeState.createWithInputValues({x:0, y:0}, "Exact Repetition", [
				atom.node,
				parseInt(limits[0])
			]), 
		}
		else if (limits.length === 2 && limits[1].length === 0) {
			const isMinimal = minimal(remaining)
			return { 
				remaining: isMinimal.remaining,
				node: NodeState.createWithInputValues({x:0, y:0}, "Minimum Repetition", [
					atom.node,
					parseInt(limits[0]),
					isMinimal.value
				]), 
			}
		}
		else if (limits.length == 2) {
			const isMinimal = minimal(remaining)
			return { 
				remaining: isMinimal.remaining,
				node: NodeState.createWithInputValues({x:0, y:0}, "Ranged Repetition", [
					atom.node,
					parseInt(limits[0]),
					parseInt(limits[1]),
					isMinimal.value
				]), 
			}
		}
		// TODO throw error
	}

	else return atom
}

const parseAtom = string => {
	if (string.startsWith("["))
		return parseCharset(string)

	else if (string.startsWith("\\"))
		return parseEscapedAtom(string, {
			...escape.digit, ...escape.word, ...escape.white, 
			...escape.tab, ...escape.linebreak, 
			...escape.boundary
		})

	else if (string.startsWith("(?:"))
		return parseGroup(string)

	else if (string.startsWith("("))
		return parseCapturingGroup(string)

	else return parseCharAtom(string) 
}

const parseCharset = string => {
	const options = []
	let inverted = false
	
	string = string.slice(1) // skip "["
	if (string.startsWith("^")){
		string = string.slice(1) // skip "^"
		inverted = true
	}

	let chars = ""

	while(string.length && !string.startsWith("]")){
		if (string.startsWith("-")){
			throw "range not implemented"
		}
		else {
			if (string.startsWith("\\")){
				const char = parseEscapedAtom(string, {
					...escape.digit, ...escape.word, ...escape.white, 
					...escape.tab, ...escape.linebreak, 
					...escape.dot
				})

				string = char.remaining
	
				if (char.node.type == "Literal")
					chars += char.node.properties[0].value
	
				else options.push(char.node)
			}
			/*else if (string.startsWith(".")){
				options.push(NodeState.create({x:0, y:0}, "Not Linebreak"))
				string = string.slice(1)
			}*/
			else {
				chars += string[0]
				string = string.slice(1)
			}
		}
	}

	if (chars.length)
	 	options.push(NodeState.createWithInputValues({x:0, y:0}, "Any of Chars", [chars]))

	if (options.length == 1) 
		return { node: options[0], remaining: string .slice(1) /* skip ']' */ }

	// TODO if (inverted)

	else return {
		node: NodeState.createWithInputValues({x:0, y:0}, "Any Of", options),
		remaining: string.slice(1) // skip ']'
	}
}

const parseEscapedAtom = (string, escapeNodes) => {
	string = string.slice(1) // skip "\"

	if (!string.length)
		return { node: null, remaining: string }

	const char = string[0]
	const escapeNode = escapeNodes[char]

	if (escapeNode != null) return { 
		node: NodeState.create({x:0, y:0}, escapeNode), 
		remaining: string.slice(1)
	}

	else return parseCharLiteral(char) 
}

const escape = {
	white: { "s": "Whitespace Char", "S": "Not Whitespace Char" },
	boundary: { "b": "Word Boundary", "B": "Not Word Boundary" },
	word: { "w": "Word Char", "W": "Not Word Char" },
	digit: { "d": "Digit", "D": "Not Digit" },
	linebreak: { "n": "Linebreak", },
	dot: { ".": "Not Linebreak" },
	tab: { "t": "Tab" },
}

const parseCharAtom = string => {
	if (!string.length) 
		return { node: null, remaining: "" }

	const char = string[0]

	if (char == ".") return { 
		node: NodeState.create({x:0, y:0}, "Not Linebreak"), 
		remaining: string.slice(1)
	}
	else return { 
		node: NodeState.createWithInputValues({x:0, y:0}, "Literal", [char]),
		remaining: string.slice(1)
	}
}

const parseCharLiteral = string => {
	if (!string.length) 
		return { node: null, remaining: "" }
	
	else return ({
		node: NodeState.createWithInputValues({x:0, y:0}, "Literal", [string[0]]),
		remaining: string.slice(1)
	})
}

const parseGroup = string => {
	string = string.slice(3) // skip "(?:"
	const alternation = parseAlternation(string, remaining => !remaining.startsWith(")"))
	if (!alternation.node) return alternation

	return {
		node: alternation.node,
		remaining: alternation.remaining.slice(1) // skip ')'
	}
}

const parseCapturingGroup = string => {
	string = string.slice(1) // skip "("
	const alternation = parseAlternation(string, remaining => !remaining.startsWith(")"))
	if (!alternation.node) return alternation

	else return {
		node: NodeState.createWithInputValues({x:0, y:0}, "Capture", [alternation.node]),
		remaining: alternation.remaining.slice(1) // skip ')'
	}
}



export { parse }