import { NodeTypes, PropertyTypes } from "./NodeTypes"

const setAtIndex = (array, elements) => Object.assign([...array], elements)


const GraphState = {
	create: () => ({
		nodes: {},
		nextId: 0,
		seed: 1,
	}),

	addNode: (graph, node, autoconnectTarget) => {
		const id = graph.nextId

		const newGraph = {
			...graph, nextId: graph.nextId + 1,
			nodes: { ...graph.nodes, [id]: node }
		}

		if (autoconnectTarget != null){
			// connect first node if nothing is connected yet
			if (graph.nodes[autoconnectTarget].type == "Expression Result"){
				const connected = GraphState.connect(newGraph, id, autoconnectTarget, 0)
				if (connected) return connected
			}
		}

		return newGraph
	},

	// convert properties containing real nodes to properties containing indices
	addNodeWithInputs: (graph, node) => {
		console.log(node)
		const autoconnectResult = Object.keys(graph.nodes).length == 1 ? 
			Object.keys(graph.nodes)[0] : null

		const extractInputs = node => {
			for (let property of node.properties)
				if (property.type === "Node" && property.value != null){
					extractInputs(property.value)

					const inputNodeId = graph.nextId
					graph = GraphState.addNode(graph, property.value)
					property.value = inputNodeId
				}
		}

		extractInputs(node)
		return GraphState.addNode(graph, node, autoconnectResult)
	},

	move: (graph, index, movement) => {
		if (index == null) return graph
		const node = graph.nodes[index]
		const newPosition = { x: node.position.x + movement.x, y: node.position.y + movement.y }
		const newNode = { ...node, position: newPosition }
		return { ...graph, nodes: { ...graph.nodes, [index]: newNode } }
	},

	// TODO not crash on cyclic connections!
	connect: (graph, node1Index, node2Index, property2Index) => {
		if (node1Index === node2Index) return null

		const node2 = graph.nodes[node2Index]
		const property2 = node2.properties[property2Index]
		if (!property2 || property2.type !== "Node") return null
		if (property2.value === node1Index) return null

		const connected = { ...property2, value: node1Index }

		// TODO unclone on disconnect

		// clone this property if required
		if (property2.duplicateOnConnect && property2.value == null){
			const properties = setAtIndex(node2.properties, {
				[property2Index]: connected,
				[node2.properties.length]: { ...property2, value: null }
			})

			const nodes = { ...graph.nodes, [node2Index]: { ...node2, properties  }}
			return { ...graph, nodes }
		}

		else return { ...graph, nodes: { ...graph.nodes, [node2Index]: { 
			...node2, properties: setAtIndex(node2.properties, { [property2Index]: connected })
		}}}
	},

	setNodeInput: (graph, nodeIndex, propertyIndex, value) => {
		if (nodeIndex == null) return graph
		const node = graph.nodes[nodeIndex]
		const property = node.properties[propertyIndex]
		const newNode = { ...node, properties: setAtIndex(node.properties, { 
			[propertyIndex]: { ...property, value } 
		}) }

		return { ...graph, nodes: { ...graph.nodes, [nodeIndex]: newNode } }
	},

	build: (index, graph) => {
		if (index == null) return "(?!)" // return a match that matches nothing
		else return NodeState.build(graph.nodes[index], graph)
	},

	generate: (index, random, graph) => {
		if (index == null) return ""
		else return NodeState.generate(graph.nodes[index], random, graph)
	},

	generateSeeded: (index, graph, i) => GraphState.generate(index, new Random(graph.seed + i), graph),
}

class Random {
	constructor(seed){ this.seed = seed }

	normalized(){
		const irrational = 1.61803398874989484820458683436563811772030917980576286213544862270526046281890
		return (Math.abs(this.seed++) * irrational) % 1
	}

	upto(maximum) { return Math.floor(this.normalized() * maximum) }
	range(min, max) { return min + this.upto(max - min) }
	select(array) { return array[this.upto(array.length)] }
	chance(chance) { return this.normalized() < chance }
}


const propertyHeight = 25

const NodeState = {
	create: (position, type) => {
		const result = ({
			position, type, properties: NodeTypes[type].defaultProperties(),
			width: NodeTypes[type].defaultWidth
		})

		if (!result.width){
			result.width = 80
			for (let property of result.properties)
				result.width = Math.max(result.width, property.name.length * 9.5 + PropertyTypes[property.type].defaultWidth)
		}

		result.position.x -= result.width / 2
		result.position.y -= (result.properties.length / 2) * propertyHeight

		return result
	},

	createWithInputValues: (position, type, inputs) => {
		const node = NodeState.create(position, type)
		let propertyIndex = 0

		for (let input of inputs){
			// skip title properties
			while(propertyIndex < node.properties.length && node.properties[propertyIndex].type == "Label")
				propertyIndex++

			// duplicate property if necessary
			if (node.properties[propertyIndex].duplicateOnConnect)
				node.properties.push({... node.properties[propertyIndex] })

			// set property
			node.properties[propertyIndex].value = input
			propertyIndex++
		}

		return node
	},

	build: (node, graph) => NodeTypes[node.type].build(node.properties, graph),
	generate: (node, random, graph) => NodeTypes[node.type].generate(node.properties, random, graph),
}

const PropertyState = {
	create: (type, name, value, duplicateOnConnect) => ({
		type, value, name, duplicateOnConnect
	}),
}


const ViewState = {
	sensitivity: 0.4,

	create: () => ({
		offset: { x: 300, y: 200 },
		magnification: 0
	}),

	getTransformScale: magnification => Math.pow(2, magnification * ViewState.sensitivity),
	
	magnify: (view, target, direction) => {
		const newMagnification = view.magnification + direction
		const newTransformScale = ViewState.getTransformScale(newMagnification)
		if (newTransformScale < 0.1 || newTransformScale > 20) return view

		const oldTransformScale = ViewState.getTransformScale(view.magnification)
		const deltaScale = newTransformScale / oldTransformScale

		return {
			magnification: newMagnification,
			offset: {
				x: (view.offset.x - target.x) * deltaScale + target.x,
				y: (view.offset.y - target.y) * deltaScale + target.y,
			}
		}
	},

	transformPoint: (view, point) => ({
		x: point.x * ViewState.getTransformScale(view.magnification) + view.offset.x,
		y: point.y * ViewState.getTransformScale(view.magnification) + view.offset.y,
	}),

	transformDirection: (view, size) => ({
		x: ViewState.transformLength(view, size.x),
		y: ViewState.transformLength(view, size.y),
	}),

	transformLength: (view, length) => length * ViewState.getTransformScale(view.magnification),

	inverseTransformLength: (view, length) => length / ViewState.getTransformScale(view.magnification),

	inverseTransformSize: (view, size) => ({
		width: size.width / ViewState.getTransformScale(view.magnification),
		height: size.height / ViewState.getTransformScale(view.magnification),
	}),

	inverseTransformDirection: (view, direction) => ({
		x: direction.x / ViewState.getTransformScale(view.magnification),
		y: direction.y / ViewState.getTransformScale(view.magnification),
	}),

	inverseTransformPoint: (view, point) => ({
		x: (point.x - view.offset.x) / ViewState.getTransformScale(view.magnification),
		y: (point.y - view.offset.y) / ViewState.getTransformScale(view.magnification),
	}),
}

export { GraphState, NodeState, PropertyState, ViewState }