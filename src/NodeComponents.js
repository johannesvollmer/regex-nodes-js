import React from 'react'
import { PropertyTypes } from "./NodeTypes"

const propertyHeight = 25

// TODO use
const classes = classes => Object.entries(classes)
	.filter(([_, enabled]) => enabled)
	.map(([name]) => name).join(" ")


/*const RawConnectionComponent = props => <line className="connection" // TODO offset y by property index
	x1={props.node2.position.x} 
	y1={props.node2.position.y + propertyHeight * (props.index + 0.5) } 
	x2={props.node1.position.x + props.node1.width} 
	y2={props.node1.position.y + propertyHeight * 0.5} 
/>*/

const RawConnectionComponent = props => {
	const x1 = props.node2.position.x 
	const y1 = props.node2.position.y + propertyHeight * (props.index + 0.5)  
	const x2 = props.node1.position.x + props.node1.width
	const y2 = props.node1.position.y + propertyHeight * 0.5
	const h1dx = Math.abs(x2 - x1) * -0.4
	const h2dx = Math.abs(x2 - x1) * 0.4

	return <path className={"connection " + props.className} // TODO offset y by property index
		d = { `M ${x1} ${y1} C ${x1 + h1dx} ${y1}, ${x2 + h2dx} ${y2}, ${x2} ${y2}` }
	/>
}

const ConnectionComponent = props => props.node.properties
	.map((property, index) => ({ property, index })) // capture index before filtering
	.filter(p => p.property.type === "Node" && p.property.value != null)
	.map(p => <RawConnectionComponent
		node1={props.graph.nodes[p.property.value]} 
		node2={props.node} index={p.index}
	/>)

const PropertyComponent = props => <div 
	className={"property" 
		+ (props.connectOutput? " main" :"")
		+ (props.connectInput? " connectable-input" :"")
	} 

	style={{ height: propertyHeight + "px" }}
	onContextMenu={e => e.preventDefault()}
	onMouseEnter={() => props.onPropertyEnter() }
	onMouseDown={e => {
		if (e.button == 0) props.onLeftPress()
		else if (e.button == 2) props.onRightPress()
	}}
>
	{<div className={(props.connectInput? "" : "inactive ") + "left connector"}></div>}
	
	<span className="title">{props.property.name}</span>

	{
		props.property && PropertyTypes[props.property.type].render({ 
			onChange: newValue => props.onChange(newValue), 
			value: props.property.value, 
		})
	}


	{<div className={(props.connectOutput? "" : "inactive ") + "right connector"}></div>}
</div>


const NodeComponent = props => <div
	className={ "graph-node" 
		+ (props.selected? " selected" : "") 
		+ (props.connecting? " connecting" : "")
		+ (props.dragged? " dragged" : "")
	}
	style={{ width: props.node.width + "px", transform: `translate(${props.node.position.x}px, ${props.node.position.y}px)` }}
>
	{
		props.node.properties
			.map((property, index) => <PropertyComponent
				property={property}
				connectInput={property.type === "Node"}
				connectOutput={index == 0}

				onPropertyEnter={() => props.onPropertyEnter(index) }
				onLeftPress={() => props.onLeftPress() }
				onRightPress={() => props.onRightPress(index) }
				onChange={newValue => props.onInputChanged(props.id, index, newValue)}
			/>)
	}
</div>



export { NodeComponent, PropertyComponent, ConnectionComponent, RawConnectionComponent }