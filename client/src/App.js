import { useState,useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBroom, faCheckSquare, faChevronLeft, faEraser, faForward, faHandSparkles, faSync, faSyncAlt, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import './App.css'
import {Helmet} from "react-helmet"
const cv = window.cv

const CONFIG = {
  URL: "http://localhost:8001"
}

const TEST_DATA = `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`


const getMethods = (obj) => {
  let properties = new Set()
  let currentObj = obj
  do {
    Object.getOwnPropertyNames(currentObj).map(item => properties.add(item))
  } while ((currentObj = Object.getPrototypeOf(currentObj)))
  return [...properties.keys()].filter(item => typeof obj[item] === 'function')
}

const CV_COLORS = {
  orange: new cv.Scalar(255, 2555, 0, 255),
  magenta: new cv.Scalar(255, 0, 255, 255),
  cyan: new cv.Scalar(0, 0, 255, 255)
}

function mergeLabel(original, label) {
  console.log(original, label)
  if(!original) return {mat: label}
  cv.bitwise_or(label, original.mat, original.mat)
  return original
}
function toRGBA(x) {
  let rgb = new cv.Mat()
  cv.cvtColor(x, rgb,cv.COLOR_GRAY2RGBA)
  return rgb
}
function rgbaToGrayscale(x) {
  let grayscale = new cv.Mat()
  cv.cvtColor(x, grayscale, cv.COLOR_RGBA2GRAY)
  return grayscale
}
function computeThreshold(image, value) {
  let threshold = new cv.Mat()
  cv.threshold(image, threshold, value, 255, cv.THRESH_TOZERO)
  let grayscale = new cv.Mat()
  cv.cvtColor(threshold, grayscale, cv.COLOR_BGR2GRAY)
  return grayscale
}
function applyComponent(res, labels, k) {
  const index = cv.matFromArray(1, 1, cv.CV_8UC1, [k])
  let component = new cv.Mat()
  cv.compare(labels, index, component, cv.CMP_EQ) //CMP_GT
  cv.bitwise_or(component, res, res)
  return component
}
function applyBrush(x, pos, size, color) {
  let brush = toRGBA(cv.Mat.zeros(x.rows, x.cols, cv.CV_8U))
  cv.circle(brush, pos, size, CV_COLORS[color], cv.FILLED)
  cv.bitwise_and(brush, x, x) 
  return x
}
function renderBrush(image, pos, size) {
  cv.circle(image, pos, size, new cv.Scalar(255, 255, 0, 255), 2)
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
  //console.log(N, "down to", cc.length)
  return {static: res, dynamic: cc}
}
function renderControls(image, pos, brushSensitivity) {
  const W = 100
  const pos1 = new cv.Point(pos.x-W/2, pos.y-45)
  const pos2 = new cv.Point(pos.x+W/2, pos.y-48)
  cv.rectangle(image, pos1, pos2, new cv.Scalar(255, 255, 0, 255), 1)
  const pos3 = new cv.Point(pos.x-W/2+W*brushSensitivity/255, pos2.y)
  cv.rectangle(image, pos1, pos3, new cv.Scalar(255, 255, 0, 255), 4)
  
  cv.putText(image, brushSensitivity.toString(), new cv.Point(pos.x - 25, pos.y-55), cv.FONT_HERSHEY_PLAIN, 2, new cv.Scalar(255, 255, 0, 255), 2)
}
function renderLabels(image, labels) {
  Object.values(labels).forEach((label) => {
    if(!label.mat) return
    cv.bitwise_or(label.mat, image, image)
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

function initClient(onInit) {
  const gapi = window.gapi
  // Client ID and API key from the Developer Console
  var CLIENT_ID = '799552289869-9th6rr7hl9s3tst4tlrerqg44856d03g.apps.googleusercontent.com'
  var API_KEY = 'AIzaSyD-QzWxUvbOw8MC7f_2PHplJMs2q8fi8wg'

  // Array of API discovery doc URLs for APIs used by the quickstart
  var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]

  // Authorization scopes required by the API; multiple scopes can be
  // included, separated by spaces.
  var SCOPES = 'https://www.googleapis.com/auth/drive'
  return () => gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: DISCOVERY_DOCS,
    scope: SCOPES
  }).then(function () {
    onInit()
  }, function(error) {
    console.error(JSON.stringify(error, null, 2))
  })
}

function fileToMultipart(filename, file, mimeType) {
  const boundary = "whatever"
  const lines = [
    "", `--${boundary}`, "Content-Type: application/json", "", JSON.stringify({name: filename, mimeType: mimeType}),
    `--${boundary}`, `Content-Type: ${mimeType}`, "Content-Transfer-Encoding: base64", "", file, `--${boundary}--`
  ]
  return [lines.join("\r\n"), boundary]
}

function OpenCVEditor({show, labels}) {
  const [data, setData] = useState({raw: null, threshold: null})
  const canvas = useRef(null)
  const cv = window.cv 
  const gapi = window.gapi
  const [toolPosition, setToolPosition] = useState({x: 0, y: 0})
  const [brushSize, setBrushSize] = useState(10)
  const [brushSensitivity, setBrushSensitivity] = useState(80) //=threshold
  const [isEditingBrush, setIsEditingBrush] = useState(false)
  const [editingSrc, setEditingSrc] = useState(0)
  const [editingStart, setEditingStart] = useState(0)
  const [cursorMask, setCursorMask] = useState()
  const moveTool = e => {
    if(!canvas.current) return
    if(!isEditingBrush) {
      const rect = canvas.current.getBoundingClientRect()
      setToolPosition({x: Math.round((e.clientX - rect.left)), y: Math.round((e.clientY - rect.top))})
    } else {
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
  
  const commitLabel = () => {
    let label = labels.value[labels.current]
    //console.log(cursorMask.rows, cursorMask.cols, cursorMask)
    
    if(!label.mat) {
      const m = cv.Mat.zeros(cursorMask.rows, cursorMask.cols, cursorMask.type())
      label = Object.assign({}, label, {mat: m})
    }
    const l = mergeLabel(label, cursorMask)
    
    labels.set(prev => Object.assign({}, prev, {[labels.current]: l}))
  }
  const readData = e => {
    const mat = cv.imread(e.target)
    setData({raw: mat})
  }
  
  
  useEffect(() => {
    if(!data || !data.threshold || !data.threshold.ptr) return
    setData(data0 => Object.assign({}, data0, {cc: getCC(data0.threshold)}))
  }, [brushSensitivity, data.raw && data.raw.ptr, data.threshold && data.threshold.ptr])
  useEffect(() => {
    if(!data || !canvas.current || !data.raw || !data.threshold || !data.cc) return
    let copy = data.raw.clone()
    const pos = new cv.Point(toolPosition.x, toolPosition.y)
    let component = nearestNeighbour(toolPosition, data.cc.dynamic)
    let r = applyBrush(toRGBA(component.mat), pos, brushSize, labels.value[labels.current].color)
    let rc = r.clone()
    renderLabels(rc, labels.value)
    setCursorMask(r)
    let res = r.clone()
    cv.addWeighted(copy, 1.0, rc, 1.0, 0, res)
    if(isEditingBrush) {
      renderControls(res, pos, brushSensitivity)
    }
    renderBrush(res, pos, brushSize)
    cv.imshow(canvas.current, res)
  }, [data.raw && data.raw.ptr, data.threshold && data.threshold.ptr, data.cc && data.cc.static && data.cc.dynamic, canvas && canvas.current, toolPosition.x, toolPosition.y, brushSize, brushSensitivity])
  useEffect(() => {
    if(!data || !data.raw) return
    setData((p) => Object.assign({}, p, {threshold: computeThreshold(p.raw, brushSensitivity)}))
  }, [data.raw, brushSensitivity])
  return (
    <div style={show ? {} : {display: "none"}}>
      <img
        style={{display: 'none'}}
        onLoad={readData}
        src={`data:image/jpeg;base64, ${TEST_DATA}`} />
      <canvas 
        ref={canvas}
        onClick={commitLabel}
        onMouseMove={moveTool}
        onMouseUp={() => setIsEditingBrush(false)}
        onWheel={controlBrush}
        onContextMenu={onRightClick}
      />
    </div>
  )
}

function Editor({show}) {
  const labelPlaceholder = useRef(null)
  const [labels, setLabels] = useState({
    0: {color: "orange"}, 
    1: {color: "magenta"}, 
    2: {color: "cyan"}
  })
  const [state, setState] = useState({label: 0})
  const gapi = window.gapi
  const uploadLabel = (image, filename) => {
    const file = image.replace("data:image/png;base64,", "")
    const [data, boundary] = fileToMultipart(`${filename}.png`, file, "image/png")
    if(!window.gapi) return //return error or throw
    window.gapi.client.request({
      path: '/upload/drive/v3/files?uploadType=multipart',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: data
    }).execute((res) => console.log("exe", res))
  }
  const next = () => {
    Object.entries(labels).forEach(([key, label]) => {
      if(!label.mat) return
      cv.imshow(labelPlaceholder.current, rgbaToGrayscale(label.mat))
      uploadLabel(labelPlaceholder.current.toDataURL("image/png"), `label_${key}`)
    })
  }
  return (
    <div style={show ? {} : {display: "none"}}>
      <div className="app-navbar">
        <FontAwesomeIcon className="navbar-icon" icon={faChevronLeft} onClick={() => {}} />
        <div className="editor-main-toolbar">
          <FontAwesomeIcon className="navbar-icon" icon={faSyncAlt} />
          <FontAwesomeIcon className="navbar-icon" icon={faCheckSquare} onClick={() => next()} />
          <FontAwesomeIcon className="navbar-icon" icon={faForward} />
          <FontAwesomeIcon className="navbar-icon" icon={faTrashAlt} />
        </div>
        <div className="editor-toolbox" style={{display: 'flex'}}>
          <ThresholdBrushIcon height={28} width={28} onClick={() => {}} />
        </div>
        <div className="navbar-dashboard">
          {Object.entries(labels).map(([k, l]) => (
            <div 
              style={{background: l.color, height: '28px', width: '28px', borderRadius: '100%'}} 
              onClick={() => setState(p => Object.assign({}, p, {label: k}))} 
            />
          ))}
        </div>
      </div>
      <OpenCVEditor show={true} labels={{current: state.label, value: labels, set: setLabels}} />
      <canvas ref={labelPlaceholder} />
    </div>
  )
}

function listFiles() {
  window.gapi.client.request('/drive/v3/files').execute(r => {
    console.log(r)
  })
}

function listDrives(callback) {
  if(!window.gapi) return
  window.gapi.client.request('/drive/v3/drives').execute(r => {
    
  })
}

function ls(callback) {
  window.gapi.client.drive.files.list({
    q: "mimeType = 'application/vnd.google-apps.folder'"
  }).then(r => {
    callback(r.result.files)
  })
}

function previewFolder(source, callback) {

}

function lsImages(folderId, consumeFiles) {
  window.gapi.client.drive.files.list({
    q: `(mimeType = 'image/png' or mimeType = 'image/jpeg') and '${folderId}' in parents`
  }).then(r => {
    consumeFiles(r.result.files)
  })
}

function getImage(fileId, consumeImage) {
  window.gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media'
  }).then(res => consumeImage(`data:${res.headers["Content-Type"]};base64,${btoa(res.body)}`))
}

function DriveFolder({file}) {
  const [files, setFiles] = useState([])
  const [preview, setPreview] = useState()
  useEffect(() => {
    if(!file.id) return
    lsImages(file.id, setFiles)
  }, [file.id])
  useEffect(() => {
    if(files.length < 1) return
    getImage(files[0].id, setPreview)
  }, [files.length])
  return (
    <div style={{width: '240px', background: 'rgba(30,30,30,0.5)', 
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      borderRadius: '8px', justifyContent: 'space-between'
    }}>
      <span>{file.name}</span>
      <img src={preview} alt="preview" style={preview ? {width: '200px'} : {display: 'none'}} />
      <button>Create project from source</button>
      <span>{files.length} files</span>
    </div>
  )
}

function Home({show}) {
  const gapi = window.gapi
  const [folders, setFolders] = useState([])
  useEffect(() => {
    if(!show) return
    ls(setFolders)
  }, [show])
  return (
    <div style={show ? {} : {display: 'none'  }}>
      <h1>PIXL</h1>
      <h2>Projects</h2>

      <h2>Create project</h2>
      <h3>GDrive sources</h3>
      <div style={{display: 'flex', justifyContent: 'space-around'}}>
        {folders.map((f) => <DriveFolder 
          file={f}
        />)}
      </div>
    </div>
  )
}

function App() {
  const [state, setState] = useState({view: "home"})
  const [gapiState, setGapiState] = useState('unloaded')
  const gapi = window.gapi
  console.log("GAPI", gapi)
  useEffect(() => {
    if(!gapi) {
      console.log('NO_API event listener')
      window.addEventListener('gapi', () => console.log("gapi changed"))
      return
    }
    if("client" in gapi) {
      console.log("API ready!")
    }
    if(gapiState === "loaded") {
      //gapi.auth2.getAuthInstance().signIn()
      console.log("loading Google API...")
      gapi.load('client:auth2', initClient(() => {
        console.log("loaded")
        window.gapi.auth2.getAuthInstance().signIn()
        window.gapi.auth2.getAuthInstance().isSignedIn.listen((args) => console.log("state changes", args))
        setGapiState('signedin')
      }))
    } 
  }, [window.gapi, gapi, gapiState])
  return (
    <div className="app-main">
      <Helmet>
        <script async defer src="https://apis.google.com/js/api.js"
          onLoad={() => {
            console.log("loading...")
            console.log(window.gapi)
            window.gapi.load('client:auth2', initClient)
          }} />
      </Helmet>
      <div style={gapiState === 'unloaded' ? {} : {display: 'none'}}>
          <button onClick={() => setGapiState('loaded')}>Sign in</button>
      </div>
      <Home show={state.view === 'home' && gapiState === 'signedin'} />
      <Editor show={gapiState === 'signedin' && state.view === 'editor'} />
    </div>
  )
}

export default App

// /Users/fredericgessler/Documents/amiscan/asbestos/misc/*
// /Users/fredericgessler/Documents/amiscan/experimental/mask/checkpoints/deeplabv3_mobilnetv2beneficial_rattlesnake-epoch59.ckpt