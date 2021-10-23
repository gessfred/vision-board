import { useState,useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBroom, faCheckSquare, faChevronLeft, faEraser, faForward, faHandSparkles, faSync, faSyncAlt, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import './App.css'

const CONFIG = {
  URL: "http://localhost:8001"
}


const getMethods = (obj) => {
  let properties = new Set()
  let currentObj = obj
  do {
    Object.getOwnPropertyNames(currentObj).map(item => properties.add(item))
  } while ((currentObj = Object.getPrototypeOf(currentObj)))
  return [...properties.keys()].filter(item => typeof obj[item] === 'function')
}

/*const MOCKS = {
  datasets: [
    {dsId: "d123", name: "Asbestos Segmentation", preview: "", }
  ],
  glob: {files: ["1.tif", "2.tif"], previews: ["", ""]}
}*/

/*
const DEBUG = false
if(DEBUG) {
  const def = window.fetch
  window.fetch = (req) => {
    console.log(`${req.method} ${typeof req}`)
    if(req.endsWith("/glob")) {
      return new Promise((resolve, reject) => {
        resolve({
          json: async () => MOCKS.glob
        })
      })
    }
    if(req.endsWith("/datasets")) {
      return new Promise((resolve, reject) => {
        resolve({
          json: async () => MOCKS.glob
        })
      })
    }
    def(req)
  }
}
{
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({components: this.components.labelled()})
      }

*/

function DatasetCard(props) {
  return (
    <div>
      {props.ds.name}
      <button onClick={() => props.open(props.ds.datasetId)}>Resume</button>
    </div>
  )
}

function Home(props) {
  const [datasets, setDatasets] = useState([])
  useEffect(() => {
    if(props.show) {
      fetch(`${CONFIG.URL}/datasets`)
        .then(res => res.json())
        .then(setDatasets)
    }
  }, [props.show])
  return (
    <div style={props.show ? {} : {display: "none"}}>
      <h2>Datasets</h2>
      {datasets.map((ds) => <DatasetCard open={props.openDataset} ds={ds} onResume={() => console.log("resume")} />)}
      <button className="home-new_env" onClick={props.createEnv}>
        New Dataset
      </button>
    </div>
  )
}

function datasetHandle(ds, setEnv, onCreation){
  const setText = (field) => (e) => {
    setEnv(prev => Object.assign({}, prev, {[field]: e.target.value}))
  }
  return {
    create: async () => {
      let body = {name: ds.name, pattern: ds.glob}
      if(ds.model !== undefined) body["model"] = ds.model
      const res = await fetch(`${CONFIG.URL}/datasets/`, {
        method: "POST",
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const handle = await res.json()
      console.log("created dataset", handle.datasetId)
      onCreation(handle.datasetId)
    },
    setName: setText("name"),
    setGlob: setText("glob"),
    preview: () => ds.previews !== undefined ? ds.previews : [],
    files: () => ds.files && `${ds.files.length} files`,
    storageSize: () => "100MB",
    hasExternalModel: () => ds.model !== undefined,
    updateExternalModel: (e) => setEnv(p => Object.assign({}, p, {model: e.target.value}))
  }
}

async function previewGlob(glob, model, setDs) {
  const modelpath = model === undefined ? "" : `&modelpath=${model}`
  const res_ = await fetch(`${CONFIG.URL}/preview?pattern=${encodeURIComponent(glob)}${modelpath}`)
  const res = await (res_).json()
  setDs(ds => Object.assign({}, ds, res))
}

function DatasetCreator(props) {
  const [ds_, setDs] = useState({name: "Untitled", glob: ""})
  const toggleExternalModel = () => {
    setDs(p => {
      if(p.model !== undefined) return Object.assign({}, p, {model: undefined})
      return Object.assign({}, p, {model: ""})
    })
  }
  const ds = datasetHandle(ds_, setDs, props.onCreation)
  useEffect(() => {
    if(props.show)
      previewGlob(ds_.glob, ds_.model, setDs)//.then(() => console.log("op"))
  }, [ds_.glob, ds_.model, props.show])
  return (
    <div style={props.show ? {} : {display: "none"}}>
      <button onClick={props.cancel}>Back</button>
      <h2>Dataset creation</h2>
      <label>Name</label>
      <input value={ds_.name} onChange={ds.setName}></input>
      <label>Glob</label>
      <input value={ds_.glob} onChange={ds.setGlob} ></input>
      <input type="checkbox" checked={ds.hasExternalModel()} onChange={toggleExternalModel}></input>
      <label>External model</label>
      <input value={ds_.model} style={ds.hasExternalModel() ? {} : {display: "none"}} onChange={ds.updateExternalModel}></input>
      <label>Classes</label>
      <div className="creator-stats-container">
        <small>{ds.files()}</small>
        <small>{ds.storageSize()}</small>
      </div>

      <h3>Preview</h3>
      <button onClick={() => previewGlob(ds_.glob, ds_.model, setDs)}>Refresg</button>
      <div className="creator-preview-container">
        {ds.preview().map(preview => <img 
          height="128px"
          src={`data:image/jpeg;base64, ${preview}`}
        />)}
      </div>
      <button onClick={ds.create}>
        Create
      </button>
    </div>
  )
}

function datasetEditHandle(ds, setDs, setImage, setLastK, setUrl) {
  const handle = {
    current: ds,
    get: (key) => ds[key],
    totalFiles: () => ds.files && `${ds.files.length} files`,
    filesRemaining: function () {
      if(!ds.files || !ds.stats) return 0
      return ds.files.length - ds.stats.annotated - ds.stats.skipped
    },
    progressRatio: function() {
      if(!ds.files || !ds.stats) return 0
      return (ds.stats.annotated + ds.stats.skipped) / ds.files.length
    },
    annotatedFilesCount: function() {
      if(!ds.stats) return "x"
      return ds.stats.annotated
    },
    secondsPerSample: function() {
      if(!ds.avgLabelDuration) return "?"
      const secondsETA = ds.avgLabelDuration / 1000
      return `${(secondsETA / 60).toFixed(0)}min ${(secondsETA % 60).toFixed(0)}s`
    },
    eta: function () {
      if(!ds.files || !ds.avgLabelDuration)return "0:00:00"
      const secondsETA = this.filesRemaining() * ds.avgLabelDuration / 1000
      const minutesETA = secondsETA / 60
      return `${(minutesETA / (60*24)).toFixed(0)} days, ${((minutesETA / 60) % 24).toFixed(0)}:${(minutesETA % 60).toFixed(0)}`
    },
    topK: () => ds.topK ? ds.topK : [],
    setPreferredClass: (c) => setDs(prev => Object.assign({}, prev, {preferredClass: c})),
    classes: () =>  {
      if(ds.classes) {
        return ds.classes
      }
      return {
        0: {name: "Amosit", color: "green", value: 0},
        1: {name: "Chrysotil", color: "purple", value: 1},
        2: {name: "Dust", color: "orange", value: 2}
      }
    },
    preferredClass: function() {
      if(ds.preferredClass) return ds.preferredClass
      else {
        const defaultClass = Object.values(this.classes()).filter(c => c.isDefault)
        if(defaultClass.length > 0) return defaultClass[0].value
        return 0
      }
    }
  }
  handle.head = {
    image: () => ds.head ? ds.head.image : "",
    components: {
      all: () => ds.head && ds.head.components ? ds.head.components : [],
      labelled: function() {
        return this.all()
          .filter(component => component.label !== undefined)
          .map(component => {
            return {
              key: component.key,
              label: component.label,
              labellingTool: component.labellingTool
            }
          })
      },
      fill: function (key) {
        const components = this.all()
        if(key >= components.length) return "yellow"
        const component = components[key]
        if(component.label !== undefined) {
          return handle.classes()[component.label].color
        }
        return "yellow"
      } 
    },
    rotateLabel: function(key, tool) {
      const components = this.components.all().slice()
      if(key >= components.length) return
      const component = components[key]
      component.labellingTool = tool
      if(!component.isPreferredSet) { //if component has no
        component.label = handle.preferredClass()
        component.isPreferredSet = true
      } else {
        component.label = (component.label + 1) % Object.keys(handle.classes()).length
      }
      setDs(prev => Object.assign({}, prev, {components: components}))
    },
    setComponent: (key, label) => {
      const cc = this.all().slice()
      cc[key].label = label
      setDs(prev => Object.assign({}, prev, {components: cc}))
    },
    commit: function() {
      if(!ds.datasetId) return
      console.log(JSON.stringify({components: this.components.labelled()}))
      fetch(`${CONFIG.URL}/datasets/${ds.datasetId}/head/commit`)
      .then(res => res.json())
      .then(head => {
        setUrl(head.url)
        setDs(head.dataset)
        setImage(head.image)
        setLastK(head.lastK)
      })
    },
    skip: () => {
      if(!ds.datasetId) return
      fetch(`${CONFIG.URL}/datasets/${ds.datasetId}/head/skip`)
      .then(res => res.json())
      .then(head => {
        setUrl(head.url)
        setDs(head.dataset)
        setImage(head.image)
        setLastK(head.lastK)
      })
    },
    discard: () => {
      if(!ds.datasetId) return
      fetch(`${CONFIG.URL}/datasets/${ds.datasetId}/head/discard`)
      .then(res => res.json())
      .then(head => setDs(p => Object.assign({}, p, {head: head})))
    }
  }
  return handle
}

function applyBrush(datasetId, pos, rad, thresh) {
  let t = Number.isNaN(thresh) ? "" : `&threshold=${thresh}`
  return fetch(`${CONFIG.URL}/datasets/${datasetId}/head/brush?x=${pos.x}&y=${pos.y}&radius=${rad}&${t}`)
  .then(res =>res.json())
}

function ThresholdBrush(props) {
  const hide = !props.show || !props.position //|| props.position.x > 256 || props.position.x < 0 || props.position.y < 0 || props.position.y > 256
  const [requests, setRequests] = useState(0)
  const [lastRequest, setLastRequest] = useState()
  useEffect(() => {
    setLastRequest({pos: props.position, rad: Math.round(props.brushSize)})
    if(!hide && requests < props.rateLimit) {
      setRequests(req => req + 1)
      applyBrush(props.datasetId, props.position, Math.round(props.brushSize), props.threshold)
      .then(res => res && res.components && props.setCC([res.components]))
      .finally(() => setRequests(req => req - 1))
    }
  }, [hide, props.position.x, props.position.y, props.brushSize, props.threshold])
  useEffect(() => {
    if(requests == 0 && lastRequest !== undefined) {
      setLastRequest(undefined)
      applyBrush(props.datasetId, lastRequest.pos, lastRequest.rad, props.threshold)
      .then(res => res && res.components && props.setCC([res.components]))
      .finally(() => setRequests(0))
    }
  }, [requests, lastRequest && JSON.stringify(lastRequest)])
  useEffect(() => props.show && setRequests(0), [props.show])
  if(hide) 
    return <span />
  return (
    <g>
      {props.isEditing && <text fontSize="24px" x={props.position.x} y={props.position.y - props.brushSize - 24} fill="cyan" textAnchor="middle" >{props.threshold}</text>}
      {props.isEditing && 
       <rect 
        x={props.position.x - 50} 
        y={props.position.y - props.brushSize - 16} 
        fill="cyan" width={100} height="8" fillOpacity="1" />}
      {props.isEditing && 
       <rect 
       x={props.position.x - 50} 
       y={props.position.y - props.brushSize - 16} 
       fill="dodgerblue" width={100 * props.threshold / 255} height="8" fillOpacity="1" />}
      <circle cx={props.position.x} cy={props.position.y} r={props.brushSize} fillOpacity={0} stroke="red" strokeWidth="2px" strokeOpacity={1.0} />
    </g>
  ) 
}

function AutoBrush(props) {
  useEffect(() => {
    if(props.show) 
      fetch(`${CONFIG.URL}/datasets/${props.datasetId}/head/auto?x=${props.position.x}&y=${props.position.y}&side=${props.brushSize}&labelFilter=${props.label}`)
      .then(res =>res.json())
      .then(res => res && res.paths && props.setCC(res.paths))
  }, [props.show, props.position.x, props.position.y])
  if(!props.show) return <span/>
  return (
    <g>
      <rect x={props.position.x - props.brushSize} y={props.position.y - props.brushSize} fill="none" width={props.brushSize*2} height={props.brushSize*2} stroke="red" strokeWidth="5px" />
    </g>
  )
}

function Gallery(props) {
  const H = 300//window.innerHeight - 32 - 16 - 8 // add listener
  const [toolPosition, setToolPosition] = useState({x: 0, y: 0})
  const [showBrush, setShowBrush] = useState(true)
  const [brushSize, setBrushSize] = useState(10)
  const [brushSensitivity, setBrushSensitivity] = useState(1)
  const img = props.image
  const [frozenComponents, setFrozenComponents] = useState([])
  const [currentComponents, setCurrentComponents] = useState([])
  const [isEditingBrush, setIsEditingBrush] = useState(false)
  const [editingSrc, setEditingSrc] = useState(0)
  const [editingStart, setEditingStart] = useState(0)
  const svg = useRef(null)
  const image=useRef(null)
  const container = useRef(null)
  const moveTool = e => {
    if(!svg.current) return
    if(!isEditingBrush) {
      const rect = svg.current.getBoundingClientRect()
      setToolPosition({x: Math.round((e.clientX - rect.left)*256/H), y: Math.round((e.clientY - rect.top)*256/H)})
    } else {
      setBrushSensitivity(Math.round((e.clientX - editingSrc) + editingStart + 255) % 255) // TODO prevent overflow
    }
  }
  const controlBrush = event => {
    event.preventDefault()
    setBrushSize(x => x + event.deltaY * 0.01)
  }
  useEffect(() => {
    setFrozenComponents([])
    setCurrentComponents([])
  }, [props.image])
  const onRightClick = (e) => {
    e.preventDefault()
    setIsEditingBrush(true)
    setEditingSrc(e.clientX)
    setEditingStart(brushSensitivity)
  }
  const commitLabel = (e) => {
    //e.preventDefault()
    //console.log("mouse :)", e.which, e.button)
    const tool = props.tool.toolId === "auto"  ? "auto" : "brush"
    const t = `&threshold=${brushSensitivity}`
    fetch(`${CONFIG.URL}/datasets/${props.datasetId}/head/${tool}/commit?x=${toolPosition.x}&y=${toolPosition.y}&radius=${Math.round(brushSize)}&label=${props.label}${t}`)
    .then(res => res.json())
    .then(res => setFrozenComponents(res.segmentation))
  }
  return (
    <div className="editor-main-gallery" ref={container} style={props.show ? {} : {display: "none"}}>
      <img height={H} src={`data:image/jpeg;base64, ${img}`} ref={image} className="editor-main-gallery-image-bg" alt="" />
      <svg 
        ref={svg} 
        viewBox="0 0 256 256"
        width={H} height={H} 
        className="editor-main-gallery-overlay" xmlns="http://www.w3.org/2000/svg"
        onMouseMove={moveTool}
        onContextMenu={onRightClick}
        onMouseUp={() => setIsEditingBrush(false)}
        onClick={commitLabel}
        onWheel={controlBrush}
      >
        {frozenComponents.map((component, key) => {
          console.log(key, component)
          if(!props.ds.classes()[key]) return ""
          return (
            <g fillOpacity={0.4} key={key} className="editor-main-gallery-cc" fill={props.ds.classes()[key].color} onClick={() => {
              //props.ds.head.rotateLabel(key, props.tool)
            }}>
              {component.map((cc, pkey) => {
                return cc.map(c => <path key={pkey} d={c}  />)
              })}
            </g>
          )
        }
          
        )}
        {currentComponents.map(c => <path d={c} fillOpacity={0.25} fill={props.ds.classes()[props.label].color} />)}
        <ThresholdBrush 
          brushSize={brushSize}
          setCC={setCurrentComponents}
          datasetId={props.datasetId}
          position={toolPosition}
          label={props.label}
          rateLimit={3}
          isEditing={isEditingBrush}
          threshold={brushSensitivity }
          show={props.tool.toolId === "threshold" && showBrush} />
        <AutoBrush
          brushSize={brushSize}
          label={brushSensitivity % 3}
          datasetId={props.datasetId}
          setCC={setCurrentComponents}
          position={toolPosition}
          label={props.label}
          show={props.tool.toolId === "auto"}
        />
      </svg>
    </div>
  )
}

function SegmentsEditor(props) {
  const [labels, setLabels] = useState({})
  const [segments, setSegments] = useState([])
  useEffect(() => {
    if(props.show && props.datasetId) {
      fetch(`${CONFIG.URL}/datasets/${props.datasetId}/head/superpix`)
      .then(res => res.json())
      .then(res => res.segments && setSegments(res.segments))
    }
  }, [props.show, props.datasetId])
  return (
    <div className="editor-main-container" style={props.show ? {} : {display: "none"}}>
      <img src={`data:image/jpeg;base64, ${props.image}`} className="editor-main-gallery-image-bg" alt="" />
      <svg 
        viewBox="0 0 256 256"
        width={256} height={256} 
        className="editor-main-gallery-overlay" xmlns="http://www.w3.org/2000/svg">
          {segments.map((seg, k) => (
            <g className="editor-segment-tmp"
            onClick={() => {
              
              setLabels(labels_ => {
                const label = (labels_[k] !== undefined ? labels_[k] + 1 : 0)
                const newLabels = Object.assign({}, labels_, {[k]: label})
                if(label > 2) delete newLabels[k]
                console.log(newLabels)
                return newLabels
              })
            }} >
              <path d={seg} fill={labels[k] ? ["cyan", "indianred", "lightgreen"][labels[k]] : "pink"} fillOpacity={labels[k] ? 0.5 : 0.0} />
            </g>
          ))}
      </svg>
      <button></button>
    </div>
  )
}
/**

{props.ds.head.components.all().map((component, key) => 
          <g key={key} className="editor-main-gallery-cc" fill={props.ds.head.components.fill(key)} onClick={() => {
            //props.ds.head.rotateLabel(key, props.tool)
          }}>
            {component.paths.map((cc, pkey) => <path key={pkey} d={cc} />)}
          </g>
        )}
 */

function ThresholdBrushIcon(props) {
  return (
    <span className="treshold-brush-icon-container" onClick={props.onClick}>
      <svg viewBox="-250 -250 500 500" height={props.height} width={props.width} xmlns="http://www.w3.org/2000/svg" >
        <g id="quarter_pies">
          <path d="M0,0 L0,-200  A200,200 0 0,1  200,000  z" fill="black" fillOpacity="1"  />
          <path d="M0,0 L-200,0  A200,200 0 0,1    0,-200 z" fill="white" fillOpacity="1" />
          <path d="M0,0 L0,200   A200,200 0 0,1 -200,0    z" fill="black" fillOpacity="1" />
          <path d="M0,0 L200,0   A200,200 0 0,1    0,200  z" fill="white" fillOpacity="1" />
        </g>
      </svg>
    </span>
  )
}

function AutoBrushIcon(props) {
  //<circle cx="0" cy="0" r="95" stroke="black" strokeWidth="10" strokeOpacity="1" fill="none" />
  //<circle cx="0" cy="0" r="100" stroke="none" fill="gray"  />
  return (
    <span className="treshold-brush-icon-container" onClick={props.onClick}>
      <svg viewBox="-100 -100 200 200" height={props.height} width={props.width} xmlns="http://www.w3.org/2000/svg">
        <rect x="-50" y="-50" width="100" height="100" fill="black" fillOpacity="1" />
        <rect x="-45" y="-45" width="45" height="45" fill="white" />
        <rect x="0" y="0" width="45" height="45" fill="white" />
        <circle cx="-50" cy="-50" r="8" stroke="red" strokeWidth="2" fill="gray" />
        <circle cx="-50" cy="50" r="8" stroke="red" strokeWidth="2" fill="gray" />
        <circle cx="50" cy="-50" r="8" stroke="red" strokeWidth="2" fill="gray" />
        <circle cx="50" cy="50" r="8" stroke="red" strokeWidth="2" fill="gray" />
      </svg>
    </span>
  )
}

function EditorDashboard(props) {
  return (
    <div className="editor-dashboard"> </div>
  )
}
//<FontAwesomeIcon className="navbar-icon" icon={faEraser} onClick={() => setTool("eraser")} />

function EditorToolbox(props) {
  const [tool, setTool] = useState()
  useEffect(() => props.onToolChange({toolId: tool}), [tool])
  //<AutoBrushIcon width={24} height={24} onClick={() => setTool("auto")} />
  //<div onClick={() => setTool("super")}>SLIC</div>
  return (
    <div className="editor-toolbox" style={{display: 'flex'}}>
      <div className="app-navbar-btn-areola" onClick={() => props.reset()} ><FontAwesomeIcon icon={faHandSparkles} /></div>
      <ThresholdBrushIcon height={28} width={28} onClick={() => setTool("threshold")} />
      
    </div>
  )
}
//trash-tashAlt
function EditorToolbar(props) {
  return (
    <div className="editor-main-toolbar">
      <FontAwesomeIcon className="navbar-icon" icon={faSyncAlt} onClick={props.ds.head.generate} />
      <FontAwesomeIcon className="navbar-icon" icon={faCheckSquare} onClick={() => props.ds.head.commit()} />
      <FontAwesomeIcon className="navbar-icon" icon={faForward} onClick={props.ds.head.skip} />
      <FontAwesomeIcon className="navbar-icon" icon={faTrashAlt} onClick={props.ds.head.discard} />
    </div>
  )
}

function EditorProgress(props) {

}

function EditableText(props) {
  const [editMode, setEditMode] = useState(false)
  const [value, setValue] = useState(props.value)
  const onValueChange = e => {
    setValue(e.target.value)
  }
  const onEnter = () => {
    props.setValue(value)
    setEditMode(false)
  }
  return (
    <div>
      <label onClick={() => setEditMode(true)}>{props.label}</label>
      <span style={!editMode ? {} : {display: "none"}} onClick={() => setEditMode(true)}>{value}</span>
      <input type="text" style={editMode ? {} : {display: "none"}} value={value} onChange={onValueChange} onBlur={onEnter} />
    </div>
  )
}

function EditorSidebar(props) {
  const [tab, setTab] = useState("properties")
  const updateDataset = (updates) => {
    fetch(`${CONFIG.URL}/datasets/${props.ds.current.datasetId}`, {
      method: 'PATCH',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({datasetUpdates: updates})
    })
    .then(res => res.json())
    .then(res => props.setDs(res.dataset))
  }
  return (
    <div className="editor-side">
      <div className="tab-bar">
        <button onClick={() => setTab("progress")}>Progress</button>
        <button onClick={() => setTab("properties")}>Properties</button>
      </div>
      <div style={tab==="properties" ? {} : {display: "none"}} className="editor-side-tab">
        <h3>Properties</h3>
        <EditableText label="Model URL" value={props.ds.current.modelUrl} setValue={v => updateDataset({modelUrl: v})} />
      </div>
      <div style={tab==="progress" ? {} : {display: "none"}} className="editor-side-tab">
        <h3>Progress</h3>
        {props.ds.totalFiles()}
        {props.lastK.map((x, i) => <img width="128px" src={`data:image/jpeg;base64, ${x}`} key={i} alt="" />)}
      </div>
    </div>
  )
}

function secondsElapsed(start) {
  if(!start) return ""
  const seconds = (new Date() - start) / 1000
  return `${(seconds / 60).toFixed(0).toString().padStart(2, "0")}:${(seconds % 60).toFixed(0).toString().padStart(2, "0")}`
}

function Progress(props) {
  const radius = props.radius ? props.radius : 24
  const stroke = props.stroke ? props.stroke : 4
  const normalizedRadius = radius - 2*stroke
  const circumference = 2 * Math.PI * normalizedRadius
  const strokeDashoffset = circumference * (1 - props.progress)
  return (
    <svg
      className="progress-circle"
      height={radius * 2}
      width={radius * 2}
      >
      <circle
        stroke="white"
        fill="transparent"
        strokeWidth={ stroke }
        strokeDasharray={ circumference + ' ' + circumference }
        style={ { strokeDashoffset } }
        stroke-width={ stroke }
        r={ normalizedRadius }
        cx={ radius }
        cy={ radius }
        />
    </svg>
  )
}

function Editor(props) {
  const [ds_, setDs]  = useState({})
  const [state, setState] = useState({tool: {toolId: "threshold", params: {}}})
  const [image, setImage] = useState("")
  const [label, setLabel] = useState(0)
  const [lastK, setLastK] = useState([])
  const [url, setUrl] = useState("")
  const [fileStartTime, setFileStartTime] = useState()
  const [elapsed, setElapsed] = useState("")
  const ds = datasetEditHandle(ds_, setDs, setImage, setLastK, setUrl)
  useEffect(() => {
    if(props.show) {
      fetch(`${CONFIG.URL}/datasets/${props.config.datasetId}`)
        .then(res => res.json())
        .then(setDs)
    }
  }, [props.show])
  useEffect(() => {
    if(ds_.datasetId && props.show) {
      fetch(`${CONFIG.URL}/datasets/${ds_.datasetId}/head/image`)
      .then(res => res.json())
      .then(res => {
        setUrl(res.url)
        setImage(res.image)
        setLastK(res.lastK)
        setFileStartTime(new Date())
      }) 
    }
  }, [ds_.datasetId, props.show])
  const reset = () => {
    console.log("reset")
    fetch(`${CONFIG.URL}/datasets/${ds_.datasetId}/head/reset`)
    .catch(err => console.log(err))
  }
  /*useEffect(() => {
    if(ds_.datasetId && props.show && fileStartTime) {
      const timer = setInterval(() => setElapsed(secondsElapsed(fileStartTime)), 1000)
      return () => clearInterval(timer)
    }
  }, [ds_.datasetId, props.show, fileStartTime])*/
  ///TODO think of where should execTool be called
  return (
    <div style={props.show ? {} : {display: "none"}}>
      <div className="app-navbar">
        <FontAwesomeIcon className="navbar-icon" icon={faChevronLeft} onClick={props.goHome} />
        <EditorToolbar ds={ds} />
        <EditorToolbox ds={ds} reset={reset} onToolChange={(tool) => setState(p => Object.assign({}, p, {tool: tool}))} />
        <div className="navbar-dashboard">
          <span>{ds.annotatedFilesCount()} annotations</span>
          <span style={{marginLeft: '8px'}}>{ds.filesRemaining()} left</span>
          <span style={{marginLeft: '8px'}}>{ds.secondsPerSample()}/sample</span>
          <span style={{marginLeft: '8px', display: 'none'}}>ETA {ds.eta()}</span>
          <span style={{marginLeft: '8px'}}>{elapsed}</span>
          <Progress progress={ds.progressRatio()} radius={20} />
        </div>
        <div>
          {Object.values(ds.classes()).map(c => (
            <span className="label-icon" style={{background: c.color}} onClick={() => setLabel(c.value)} />
          ))}
        </div>
      </div>
      <div className="editor-root">
        <div className="editor-top">
          <div className="editor-main">
            <small style={{fontSize: '10px'}}>{url}</small>
            <Gallery image={image} ds={ds} datasetId={ds_.datasetId} tool={state.tool} label={label} show={state.tool.toolId !== "super"} />
            <SegmentsEditor image={image} ds={ds} datasetId={ds_.datasetId} show={state.tool.toolId === "super"} />
          </div>
          <div>
            <h3>History</h3>
            <div style={{display: 'flex'}}>
              {lastK && lastK.map(img => <img 
              width={200} height={200}
                src={`data:image/jpeg;base64, ${img}`} 
                className="editor-main-gallery-image-bg" alt="" />)}
            </div>
          </div>
        </div>
        <div className="editor-bottom-container">
          <EditorDashboard />
        </div>
      </div>
    </div>
  )
}
//<EditorSidebar ds={ds} setDs={setDs} lastK={lastK} />
function appHandle(setState) {
  return {
    launch: () => {
      setState({main: "creator"})
    },
    gotoHome: () => {
      setState({main: "home"})
    },
    create: (datasetId) => {//TODO rename to createDataset
      setState({main: "editor", editor: {datasetId: datasetId}})
    },
    openDataset: (datasetId) => {
      setState({main: "editor", editor: {datasetId: datasetId}})
    }
  }
}

const TEST_IMG_URL = "http://img.webmd.com/dtmcms/live/webmd/consumer_assets/site_images/article_thumbnails/other/cat_relaxing_on_patio_other/1800x1200_cat_relaxing_on_patio_other.jpg?resize=750px:*"

const TEST_DATA = `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`

function OpenCVThresholding() {
  const H = 768
  const [data, setData] = useState({raw: null, threshold: null})
  //const [threshold, setThreshold] = useState()
  const canvas = useRef(null)
  const cv = window.cv //cv.Mat.ones(1, 1, cv.CV_8U)
  //console.log(cv.Scalar, one)
  const [toolPosition, setToolPosition] = useState({x: 0, y: 0})
  const [brushSize, setBrushSize] = useState(10)
  const [brushSensitivity, setBrushSensitivity] = useState(80) //=threshold
  const [isEditingBrush, setIsEditingBrush] = useState(false)
  const [editingSrc, setEditingSrc] = useState(0)
  const [editingStart, setEditingStart] = useState(0)
  const [labels, setLabels] = useState({})
  const moveTool = e => {
    if(!canvas.current) return
    if(!isEditingBrush) {
      const rect = canvas.current.getBoundingClientRect()
      setToolPosition({x: Math.round((e.clientX - rect.left)), y: Math.round((e.clientY - rect.top))})
    } else {
      console.log(brushSensitivity)
      setBrushSensitivity(Math.round((e.clientX - editingSrc) + editingStart + 255) % 255) // TODO prevent overflow
    }
  }
  const controlBrush = event => {
    event.preventDefault()
    setBrushSize(x => x + event.deltaY * 0.01)
  }
  const onRightClick = (e) => {
    e.preventDefault()
    setIsEditingBrush(true)
    setEditingSrc(e.clientX)
    setEditingStart(brushSensitivity)
  }
  function computeThreshold(image, value) {
    let threshold = new cv.Mat()
    cv.threshold(image, threshold, value, 255, cv.THRESH_TOZERO)
    let grayscale = new cv.Mat()
    cv.cvtColor(threshold, grayscale, cv.COLOR_BGR2GRAY)
    return grayscale
  }
  const readData = e => {
    const mat = cv.imread(e.target)
    setData({raw: mat})
  }
  function toRGBA(x) {
    let rgb = new cv.Mat()
    cv.cvtColor(x, rgb,cv.COLOR_GRAY2RGBA)
    return rgb
  }
  function applyComponent(res, labels, k) {
    const index = cv.matFromArray(1, 1, cv.CV_8UC1, [k])
    let component = new cv.Mat()
    cv.compare(labels, index, component, cv.CMP_EQ)
    cv.bitwise_or(component, res, res)
    return component
  }
  function getCC(threshold) {
    let cc = []
    let labels = new cv.Mat()
    let centroids = new cv.Mat()
    let stats = new cv.Mat()
    const N = cv.connectedComponentsWithStats(threshold, labels, stats, centroids, 8)
    let res = cv.Mat.zeros(threshold.rows, threshold.cols, cv.CV_8U)
    for(let k = 1; k < stats.rows; ++k) { // skip the background label
      if(stats.intAt(k, cv.CC_STAT_AREA) > 10) {
        const component = applyComponent(res, labels, k)
        //get components as image,x,y
        const x = stats.intAt(k, cv.CC_STAT_LEFT)
        const y = stats.intAt(k, cv.CC_STAT_TOP)
        const w = stats.intAt(k, cv.CC_STAT_WIDTH)
        const h = stats.intAt(k, cv.CC_STAT_HEIGHT)
        const c = {
          mat: component, 
          idx: k, 
          center: {x: x + w/2, y: y + h/2},
          area: stats.intAt(k, cv.CC_STAT_AREA)
        }
        cc.push(c)
      }
    }
    console.log(N, "down to", cc.length)
    return {static: res, dynamic: cc}
  }
  function applyBrush(x, pos, size) {
    let brush = toRGBA(cv.Mat.zeros(x.rows, x.cols, cv.CV_8U))
    cv.circle(brush, pos, size, new cv.Scalar(255, 255, 255, 255), cv.FILLED)
    cv.bitwise_and(brush, x, x) 
    return x
  }
  function renderBrush(image, pos) {
    cv.circle(image, pos, brushSize, new cv.Scalar(255, 255, 0, 255), 2)
  }
  function renderControls(image, pos) {
    const W = 100
    const pos1 = new cv.Point(pos.x-W/2, pos.y-45)
    const pos2 = new cv.Point(pos.x+W/2, pos.y-48)
    cv.rectangle(image, pos1, pos2, new cv.Scalar(255, 255, 0, 255), 1)
    const pos3 = new cv.Point(pos.x-W/2+W*brushSensitivity/255, pos2.y)
    cv.rectangle(image, pos1, pos3, new cv.Scalar(255, 255, 0, 255), 4)
    
    cv.putText(image, brushSensitivity.toString(), new cv.Point(pos.x - 25, pos.y-55), cv.FONT_HERSHEY_PLAIN, 2, new cv.Scalar(255, 255, 0, 255), 2)
  }
  function renderLabels(image) {
    Object.entries(labels).forEach(([key, label]) => {

    })
  }
  const distance = (p1, p2) => (p1.x - p2.x)*(p1.x - p2.x)+(p1.y - p2.y)*(p1.y - p2.y)
  function nearestNeighbour(point, points) {
    let nearest = null
    let bestDistance = null
    for(let p of points) {
      if(!nearest || distance(point, p.center) < bestDistance) {
        nearest = p
        bestDistance = distance(point, p.center)
      }
    }
    return nearest
  }
  useEffect(() => {
    if(!data || !data.threshold || !data.threshold.ptr) return
    console.log("compute CC")
    setData(data0 => Object.assign({}, data0, {cc: getCC(data0.threshold)}))
  }, [brushSensitivity, data.raw && data.raw.ptr, data.threshold && data.threshold.ptr])
  useEffect(() => {
    if(!data || !canvas.current || !data.raw || !data.threshold || !data.cc) return
    let copy = data.raw.clone()
    const pos = new cv.Point(toolPosition.x, toolPosition.y)
    let component = nearestNeighbour(toolPosition, data.cc.dynamic)
    let r = applyBrush(toRGBA(component.mat), pos, brushSize)
    let res = r//new cv.Mat()
    //cv.addWeighted(copy, 1.0, r, 0.5, 0, res)
    renderControls(res, pos)
    renderBrush(res, pos)
    cv.imshow(canvas.current, res)
  }, [data.raw && data.raw.ptr, data.threshold && data.threshold.ptr, data.cc && data.cc.static && data.cc.dynamic, canvas && canvas.current, toolPosition.x, toolPosition.y, brushSize, brushSensitivity])
  useEffect(() => {
    if(!data || !data.raw) return
    setData((p) => Object.assign({}, p, {threshold: computeThreshold(p.raw, brushSensitivity)}))
  }, [data.raw, brushSensitivity])
  return (
    <div>
      <img
        style={{display: 'none'}}
        onLoad={readData}
        src={`data:image/jpeg;base64, ${TEST_DATA}`} />
      <canvas 
        ref={canvas}
        onMouseMove={moveTool}
        onMouseUp={() => setIsEditingBrush(false)}
        onWheel={controlBrush}
        onContextMenu={onRightClick}
      />
    </div>
  )
}

const VERSION = "EDGE"//"SERVERCLIENT"

function App() {
  const [state, setState] = useState({main: "home"})
  const app = appHandle(setState)
  if(VERSION === "EDGE")
    return <OpenCVThresholding />
  else
  return (
    <div className="app-main">
      <Home show={state.main==="home"} createEnv={app.launch} openDataset={app.openDataset} />
      <DatasetCreator show={state.main==="creator"} cancel={app.gotoHome} onCreation={app.create} />
      <Editor show={state.main==="editor"} config={state.editor} goHome={app.gotoHome} />
    </div>
  )
}

export default App

// /Users/fredericgessler/Documents/amiscan/asbestos/misc/*
// /Users/fredericgessler/Documents/amiscan/experimental/mask/checkpoints/deeplabv3_mobilnetv2beneficial_rattlesnake-epoch59.ckpt