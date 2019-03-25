import React from 'react'
import './App.css'

// https://www.regular-expressions.info/email.html
// https://stackoverflow.com/questions/46155/how-to-validate-an-email-address-in-javascript?rq=1

// TODO:
// - on node hover, highlight corresponding part in the built regex
// - automatically layout nodes generated from parsing a regex
// - user supplied example text
// - separate css into layout and theme


// import { NodeTypes } from './NodeTypes'
import { GraphState, NodeState, ViewState } from './NodeState'
import { NodeComponent, ConnectionComponent, RawConnectionComponent } from './NodeComponents'
import { NodeTypes } from './NodeTypes'
import { parse } from "./parse"

const AppState = {
	create: () => ({
		view: ViewState.create(),
		graph: GraphState.create(),
		dragged: null,
		connection: null,
		result: 0,
		search: null,
	}),

	addNode: (state, node) => {  // update required for auto connect
		if (Object.keys(state.graph.nodes).length == 1) return AppState.updateCache({
			...state, graph: GraphState.addNode(state.graph, node, Object.keys(state.graph.nodes)[0]) 
		})
		else return {
			...state, graph: GraphState.addNode(state.graph, node) 
		}
	},

	addNodeWithInputs: (state, node) => AppState.updateCache({ // update required for auto connect
		...state, graph: GraphState.addNodeWithInputs(state.graph, node) 
	}),
	
	pressMove: (state, index) => {
		if (state.graph.nodes[index].type == "Expression Result" && state.result != index)
			return AppState.updateCache({ ...state, dragged: index, result: index })

		else return { ...state, dragged: index, }
	},

	pressConnect: (state, index, input) => ({
		...state, connection: { node: index, property: input }
	}),

	connect: (state, nodeIndex, input) => {
		if (!state.connection) return state

		const graph = GraphState.connect(state.graph, 
			state.connection.node, nodeIndex, input
		)

		if (!graph) return state
		else return AppState.updateCache({ ...state, graph, connection: null })
	},

	release: state => ({ 
		...state, dragged: null, connection: null, 
	}),

	moveNode: (state, delta) => ({ 
		...state, graph: GraphState.move(state.graph, state.dragged, ViewState.inverseTransformDirection(state.view, delta))
	}),

	moveConnect: (state, position) => ({ 
		...state, connection: { ...state.connection, target: ViewState.inverseTransformPoint(state.view, position) },
	}),

	setNodeInput: (state, node, input, value) => AppState.updateCache({ ...state, graph: GraphState.setNodeInput(state.graph, node, input, value) }),

	magnify: (state, target, deltaY) => ({ ...state, view: ViewState.magnify(state.view, target, deltaY) }),
	
	nextRandomSeed: state => AppState.updateCache({ ...state, graph: { ...state.graph, seed: state.graph.seed + 1 } }),

	updateCache: state => {
		const exampleText = "‘Now off their harbour there lies a wooded and fertile is- land not quite close to the land of the Cyclopes, but still not far. It is over-run with wild goats, that breed there in great numbers and are never disturbed by foot of man; for sports- men—who as a rule will suffer so much hardship in forest or among mountain precipices—do not go there, nor yet again is it ever ploughed or fed down, but it lies a wilderness untilled and unsown from year to year, and has no living thing upon it but only goats. For the Cyclopes have no ships, nor yet shipwrights who could make ships for them; they cannot therefore go from city to city, or sail over the sea to one another’s country as people who have ships can do; if they had had these they would have colonised the island, {78} for it is a very good one, and would yield everything in due season. There are meadows that in some places come right down to the sea shore, well watered and full of lus- cious grass; grapes would do there excellently; there is level land for ploughing, and it would always yield heavily at har- vest time, for the soil is deep."
		const regex = GraphState.build(state.result, state.graph)

		if (state.cache && regex === state.cache.regex)
			return state


		return { ...state, cache: { regex, matches: [] } } // FIXME
		const compiledRegex = eval(regex) // careful there!

		// console.log(exampleText.match(compiledRegex))

		const words = exampleText.repeat(6).split(" ")

		for(let i = 0; i < 30; i++)
			words.splice((i*14) % words.length, 0, GraphState.generateSeeded(state.result, state.graph, i))

		// const exampleHTML = words.join(" ").replace(compiledRegex, "<span\nclass='match'>$&</span>")
		const augmentedExampleText = words.join(" ")
		const matches = []

		let match = null
		let fillStart = 0
		while ((match = compiledRegex.exec(augmentedExampleText)) != null) {
			matches.push({
				fill: match.input.slice(fillStart, match.index), 
				match: match[0] 
			})

			fillStart = compiledRegex.lastIndex
		}

		matches.push({
			fill: augmentedExampleText.slice(compiledRegex.lastIndex),
			match: "",
		})

	

		/*
		let remaining = augmentedExampleText
		while(remaining.length){
			const match = compiledRegex.exec(remaining)
			console.log(match)
			if (match){
				matches.push({ fill: remaining.slice(0, match.index), match: match[0] })
				remaining = remaining.slice(match.index + match[0].length)
				console.log({ fill: remaining.slice(0, match.index), match: match[0] })
			}
			else {
				matches.push({ fill: remaining, match: "" })
				remaining = ""
			}
		}*/

		// const matches = augmentedExampleText.match(compiledRegex)
		// , "<span\nclass='match'>$&</span>")
		
		// const exampleNonWhite = exampleHTML.replace(/ /g, "·\u200B")
		

		return ({
			...state,
			cache: {
				regex, 
				matches: matches.map(({match, fill}) => [
					<span>{fill}</span>, <span className="match">{match}</span>
				]), // FIXME
			}
		})
	},

	parseRegexToNodes: state => {
		const node = parse(state.search)
		return node? AppState.addNodeWithInputs(state, node) : state
	}
}


class App extends React.Component {
	constructor(props){
		super(props)

		this.state = AppState.create() 

		const initialNode = NodeState.create(
			ViewState.inverseTransformPoint(this.state.view, {
				x: window.innerWidth / 2, y: window.innerHeight / 2
			}), 
			"Expression Result"
		)
		// NodeState.create({ x:100, y:100 }, "Expression Result")
		
		this.state = AppState.addNode(this.state, initialNode)
		this.state = AppState.updateCache(this.state)
	}

	componentDidMount(){  // nasty stuff
		if (!this.listener) this.listener = document.addEventListener("keydown", e => {
			if (e.ctrlKey && e.key === " "){
				this.setState(state => ({...state, search: "" }))
			}
		})
	}

	componentWillUnmount(){
		if (this.listener){
			document.removeEventListener("keydown", this.listener)
			this.listener = null 
		}
	}

	render(){
		const offset = this.state.view.offset
		const scale = ViewState.getTransformScale(this.state.view.magnification)
		let searchRegex = null

		try {
			searchRegex = this.state.search != null && new RegExp(this.state.search, "igm")
		}
		catch (_){}
		
		return [
			<div id="example-text"> {
				this.state.cache.matches
			} </div>,


			<svg id="connection-graph"
				className = { this.state.connection? "connect-dragging" : "" }
			>
				<g transform={`translate(${offset.x}, ${offset.y}) scale(${scale}, ${scale})`} 
					className="transform"
				>
					{
						Object.entries(this.state.graph.nodes)
							.map(([id, node]) => <ConnectionComponent
								node={node} key={id} graph={this.state.graph}
							/>)
					}

					{(this.state.connection && this.state.connection.target) && <RawConnectionComponent
						node1={this.state.graph.nodes[this.state.connection.node]}
						index={-0.5} node2={{ position: this.state.connection.target }}
						className="prototype"
					/>}
				</g>
			</svg>,

			<div 
				id="node-graph"
				className = { this.state.connection? "connect-dragging" : "" }
				onWheel={ e => {
					const delta = -Math.sign(e.deltaY)
					const target = {x: e.clientX, y: e.clientY}
					this.setState(state => AppState.magnify(state, target, delta))
				} }

				onContextMenu={e => e.preventDefault()}
				onMouseUp = { event => {
					this.setState(state => AppState.release(state))
				} }
				onMouseLeave = { () => this.setState(state => AppState.release(state)) }
				onMouseMove = { e => {
					const delta = { x: e.movementX, y: e.movementY }
					const position = { x: e.clientX, y: e.clientY }
					this.setState(state => state.connection?
						AppState.moveConnect(state, position) :
						AppState.moveNode(state, delta)
					)
				}}
			>
				<div 
					style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}, ${scale})`} }
					className="transform"
				>
					{
						Object.entries(this.state.graph.nodes)
							.map(([id, node]) => <NodeComponent 
								node={node} id={id} key={id}
								graph={this.state.graph} dragged={this.state.dragged == id}
								connecting={this.state.connection && this.state.connection.node == id}

								onInputChanged = { (node, input, value) => this.setState(state => AppState.setNodeInput(state, node, input, value)) }
								onLeftPress = { () => this.setState(state => AppState.pressMove(state, id)) }
								onRightPress = { input => this.setState(state => AppState.pressConnect(state, id, input)) }
								onPropertyEnter = { input => this.setState(state => AppState.connect(state, id, input)) }
							/>)
					}
				</div>
			</div>,
				
			<div id="overlay">
				<section id="header">
          <img src="/logo.svg" id="logo"/>
					<h2>Regex Nodes</h2>
					<nav>by <a href="https://github.com/johannesvollmer/regex-nodes-js" target="_blank" rel="noopener noreferrer">
						johannesvollmer
					</a></nav>
				</section>
				
				<section id="search">
					<input type="text"
						value={this.state.search || ""} placeholder=" Add Nodes [Ctrl Space]"
						autoFocus={this.state.search != null}
						onFocus={ () => this.setState(state => ({... state, search: "" })) }
						onBlur={ () => this.setState(state => ({... state, search: null })) }
						key={this.state.search != null /* for auto focus */}
						onKeyDown={ e => {
							const enter = 13
							if (e.keyCode == enter && this.state.search.length != 0) this.setState(state => ({ 
								...AppState.parseRegexToNodes(state),
								search: null
							}))

							e.stopPropagation()
						} }
						onChange={ event => {
							const value = event.target.value
							this.setState(state => ({... state, search: value }))
						} }
					/>

					{
						this.state.search != null && <div id="results">
							{
								this.state.search.length != 0 && 
									<div id="parse-search"
										onMouseDown={() => this.setState(state => ({ 
											...AppState.parseRegexToNodes(state),
											search: null
										}))}
									>
										Add Regular expression `<code id="string">{this.state.search}</code>` as Nodes [Enter]
									</div>
							}

							{
								searchRegex != null && Object.entries(NodeTypes)
									.filter(([name, type]) => searchRegex.test(name))
									.map(([name, type]) => <div key={name}
										onMouseDown={() => this.setState(state => AppState.addNode(
											{ ...state, search: null }, 
											NodeState.create(ViewState.inverseTransformPoint(this.state.view, {x:window.innerWidth / 2, y:window.innerHeight / 2}), name)
										))}
									>{name}</div>)
							}
						</div>
					}
				</section>

				{
					this.state.result === null? null : <section id="regex">
						<code>
							const regex =&nbsp;
							<span className="string">{this.state.cache.regex}</span>

							{ // TODO GraphState.build(this.state.result, this.state.graph)? null : 
								/*&nbsp; <span className="comment" onClick={() => this.setState(state => AppState.nextRandomSeed(state))}>
									&nbsp;&nbsp;// 
									would match `{this.state.cache.shortExample}`
								</span>*/
							}

						</code> 
					</section>

				}
			</div>,
		]
	}
}

export default App