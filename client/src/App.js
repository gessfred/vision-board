import { useState,useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBroom, faCheckSquare, faChevronLeft, faEraser, faFolder, faForward, faHandSparkles, faPlus, faSignInAlt, faSync, faSyncAlt, faTrash, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import './App.css'
import {Helmet} from "react-helmet"
import ReactGA from 'react-ga' // use event(obj) or pageview(str)
const cv = window.cv


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
  cyan: new cv.Scalar(0, 0, 255, 255),
  dodgerblue: new cv.Scalar(0,0,255,255),
  red: new cv.Scalar(255,0,0,255)
}

function mergeLabel(original, label) {
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

  threshold.delete()
  return grayscale
}
function applyComponent(res, labels, k) {
  const index = cv.matFromArray(1, 1, cv.CV_8UC1, [k])
  let component = new cv.Mat()
  cv.compare(labels, index, component, cv.CMP_EQ) //CMP_GT
  cv.bitwise_or(component, res, res)

  index.delete()
  return component
}
function applyBrush(x, pos, size, color) {
  let brush = toRGBA(cv.Mat.zeros(x.rows, x.cols, cv.CV_8U))
  cv.circle(brush, pos, size, CV_COLORS[color], cv.FILLED)
  cv.bitwise_and(brush, x, x) 

  brush.delete()
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

  labels.delete()
  centroids.delete()
  stats.delete()
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

function fileToMultipart(metadata, file, mimeType) {
  const boundary = "whatever"
  const lines = [
    "", `--${boundary}`, "Content-Type: application/json", "", JSON.stringify(Object.assign({}, metadata, {mimeType: mimeType})),
    `--${boundary}`, `Content-Type: ${mimeType}`, "Content-Transfer-Encoding: base64", "", file, `--${boundary}--`
  ]
  return [lines.join("\r\n"), boundary]
}

function OpenCVEditor({show, labels, image}) {
  const [data, setData] = useState({raw: null, threshold: null})
  const canvas = useRef(null)
  const imageRef = useRef(null)
  const cv = window.cv 
  const [toolPosition, setToolPosition] = useState({x: 0, y: 0})
  const [brushSize, setBrushSize] = useState(25)
  const [brushSensitivity, setBrushSensitivity] = useState(80) //=threshold
  const [isEditingBrush, setIsEditingBrush] = useState(false)
  const [editingSrc, setEditingSrc] = useState(0)
  const [editingStart, setEditingStart] = useState(0)
  const [cursorMask, setCursorMask] = useState()
  const moveTool = e => {
    if(!canvas.current) return
    if(!isEditingBrush) {
      const rect = canvas.current.getBoundingClientRect()
      setToolPosition({
        x: Math.round(imageRef.current.width * (e.clientX - rect.left) / canvas.current.offsetWidth), 
        y: Math.round(imageRef.current.height * (e.clientY - rect.top) / canvas.current.offsetHeight)
      })
    } else {
      setBrushSensitivity(Math.round((e.clientX - editingSrc) + editingStart + 255) % 255) // TODO prevent overflow
    }
  }
  console.log(toolPosition)
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
    if(!label.mat) { // Lazily assigns a new matrix for the label
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
    if(
      !data || !canvas.current || !data.raw || !data.threshold || 
      !data.cc || !labels.value || labels.current === undefined
    ) 
      return
    let copy = data.raw.clone()
    const pos = new cv.Point(toolPosition.x, toolPosition.y)
    let component = nearestNeighbour(toolPosition, data.cc.dynamic)
    let res = copy
    if(component && component.mat) {
      const cmp = toRGBA(component.mat)
      let r = applyBrush(cmp, pos, brushSize, labels.value[labels.current].color)
      let rc = r.clone()
      renderLabels(rc, labels.value)
      setCursorMask(prev => {
        try {
          prev.delete()
        }  catch {}
        return r
      })
      res = r.clone()
      cv.addWeighted(copy, 1.0, rc, 1.0, 0, res)
      
      copy.delete()
      rc.delete()
      if(isEditingBrush) {
        renderControls(res, pos, brushSensitivity)
      }
    } 
    renderBrush(res, pos, brushSize)
    cv.imshow(canvas.current, res)

    res.delete()
  }, [data.raw && data.raw.ptr, data.threshold && data.threshold.ptr, data.cc && data.cc.static && data.cc.dynamic, canvas && canvas.current, toolPosition.x, toolPosition.y, brushSize, brushSensitivity])
  useEffect(() => {
    if(!data || !data.raw) return
    setData(p => {
      const T = computeThreshold(p.raw, brushSensitivity)
      cv.GaussianBlur(T, T, new cv.Size(5, 5), 10)
      return Object.assign({}, p, {threshold: T})
    })
  }, [data.raw, brushSensitivity])
  return (
    <div style={show ? { 
      height: 'calc(100vh - 128px)',
      display: 'flex',
      justifyContent: 'center'
    } : {display: "none"}}>
      <img
        style={{display: 'none'}}
        onLoad={readData}
        ref={imageRef}
        src={image} />
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

function projectLabels(project) {
  if(!project) return {}

  const entries =  Object.fromEntries(project.labels.map((l, i) => [i, l]))
  return entries
}

function getProjectNextFile(project, callback) {
  lsImages(project.src.id, files => {
    let annotatedFiles = []
    if(project.files && project.files.annotated) {
      annotatedFiles = project.files.annotated.map(f => f.fileId)
    }
    let filesToAnnotate = files.filter(file => !annotatedFiles.includes(file.id) && !file.name.includes('label'))
    if(filesToAnnotate.length > 0) {
      const fileId = filesToAnnotate[0].id
      getImage(fileId, data => {
        callback({
          image: data,
          fileId: fileId,
          filename: filesToAnnotate[0].name,
          startDate: new Date()
        })
      })
    } callback({})
  })
}

function Editor({show, navigateBack, project, commitFileToProject}) {
  const labelPlaceholder = useRef(null)
  const [labels, setLabels] = useState([])
  const [state, setState] = useState({label: 0})
  const [currentFile, setCurrentFile] = useState({})
  useEffect(() => {
    console.log("project changes", project)
    if(!project || !project.labels) 
      return
    setLabels(projectLabels(project))
    setCurrentFile({})
    getProjectNextFile(project, setCurrentFile)
  }, [JSON.stringify(project)])
  const uploadLabel = (image, filename) => {
    const file = image.replace("data:image/png;base64,", "")
    const ln = `_${filename}.png`
    const name = currentFile.filename.replace('.png', ln).replace('.jpeg', ln).replace('.jpg', ln)
    const metadata = {
      name: name,
      parents: [project.src.id]
    }
    const [data, boundary] = fileToMultipart(metadata, file, "image/png")
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
    commitFileToProject(currentFile)
  }
  const live = currentFile.image !== undefined
  return (
    <div style={show ? {} : {display: "none"}}>
      <div className="app-navbar">
        <FontAwesomeIcon className="navbar-icon" icon={faChevronLeft} onClick={navigateBack} />
        <div >
          <h2>{project && project.title}</h2>
        </div>
        <div className="editor-main-toolbar">
          <FontAwesomeIcon className="navbar-icon" icon={faCheckSquare} onClick={() => next()} />
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
      <OpenCVEditor 
        show={live} 
        labels={{current: state.label, value: labels, set: setLabels}} 
        image={currentFile.image}
        
      />
      <div style={!live ? {} : {display:'none'}}>
        <h1>No more files.</h1>
      </div>
      <canvas style={{display: 'none'}} ref={labelPlaceholder} />
    </div>
  )
}


function DriveFolder({file, createFromSource}) {
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
    <div style={{background: 'rgba(49,49,49,0.7)', 
      display: 'flex', flexDirection: 'row', alignItems: 'center',
      borderRadius: '8px', justifyContent: 'space-between', overflow: 'hidden',
      margin: '8px'
    }}>
      <div style={{display: 'flex', height: '100%', justifyContent: 'flex-start', alignItems: 'center'}}>
        <img 
          src={preview} 
          alt="preview" 
          style={preview ? {height: '96px', maxWidth: '96px', marginRight: '16px'} : {display: 'none'}}   
        />
        <span>{file.name}/</span>
        <span>{files.length} files</span>
      </div>
      <button onClick={createFromSource}>Create project from source</button>
    </div>
  )
}

function getprojects(setProjects) {
  let projects = localStorage.getItem('projects')
  if(!projects) projects = []
  try {
    projects = JSON.parse(projects)
  } catch {
    console.log("error reading projects")
    projects = []
  }
  setProjects(projects)
}

function createProject(project) {
  getprojects(projects => {
    let newValue = projects 
    newValue.push(project)
    localStorage.setItem('projects', JSON.stringify(newValue))
  })
}

function commitFile(project, file, setProject) {
  getprojects(projects_ => {
    let projects = projects_.slice()
    for(let p of projects) {
      if(p.src && p.src.id === project.src.id) { 
        p.files = {
          annotated: (p.files && p.files.annotated ? p.files.annotated : []).concat([{fileId: file.fileId, startDate: file.startDate}])
        }
        setProject(p)
        break
      }
    }
    localStorage.setItem('projects', JSON.stringify(projects))
  })
}

function deleteProject(projectId, cb) {
  getprojects(projects => {
    const f = projects.slice().filter(p => (p.title!==projectId.title) && (p.date!==projectId.date))
    localStorage.setItem('projects', JSON.stringify(f))
    cb(f)
  })
}

function ProjectCreator({project, create, show}) {
  const [labels, setLabels] = useState([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState()
  const changeLabel = (key, labelId) => e => {
    const labels2 = labels.slice()
    labels2[labelId][key] = e.target.value 
    setLabels(labels2) 
  }
  const createProject = () => {
    if(labels.length == 0) {
      setError('Projects must have at least one label')
      return
    }
    create({src: project, labels: labels, title: title, date: new Date()})
  }
  return (
    <div style={show ? {} : {display: 'none'}}>
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
        <h2>Title</h2>
        <input type="text" value={title} 
        style={{margin: '16px'}}
          onChange={e => setTitle(e.target.value)} 
        />
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '64px'}}>
        <div>
          <h4>Labels</h4>
          {labels.map((label, labelId) => (
            <div style={{display: 'flex'}}>
              <label>Name</label>
              <input 
                value={label.name} 
                onChange={changeLabel('name', labelId)} 
              />
              <label>Color</label>
              <input 
                value={label.color} 
                onChange={changeLabel('color', labelId)} 
              />
              <div style={{width: '24px', height: '24px', background: label.color, borderRadius: '4px'}} />
            </div>
          ))}
          <button onClick={() => setLabels(labels.concat({name: "Untitled", color: "red"}))}>
            <FontAwesomeIcon icon={faPlus} />
            Label
          </button>
        </div>
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <button onClick={createProject}>Create project</button>
          <span style={{color: 'red', fontWeight: 'bold', fontSize: '16px'}}>{error}</span>
        </div>
      </div>
    </div>
  )
}

function Project({project, resume, rm}) {
  const [files, setFiles] = useState([])
  const [preview, setPreview] = useState()
  useEffect(() => {
    if(!project || !project.src || !project.src.id) return
    lsImages(project.src.id, setFiles)
  }, [project && project.src && project.src.id])
  useEffect(() => {
    if(files.length < 1) return
    getImage(files[0].id, setPreview)
  }, [files.length])
  return (
    <div className="project-card">
      <img 
        src={preview} 
        alt="preview" 
        style={preview ? {width: '100%', height: '128px', objectFit: 'cover'} : {display: 'none'}}   
      />
      <div style={{display: 'flex', flexDirection: 'column', margin: '4px'}}>
        <h3 className="project-card-title">{project.title}</h3>
        <div style={{display: 'flex', justifyContent: 'space-between'}}>
          <small className="project-card-meta">
            {project.date}
          </small>
          <span className="project-card-src">
            <FontAwesomeIcon icon={faFolder} style={{marginRight: '8px'}} />
            {project.src && project.src.name}/
          </span>
        </div>
      </div>
      <div 
        style={{
          display: 'flex', 
          margin: '4px', 
          justifyContent: 'space-around',
          padding :'16px',
          fontSize: '28px'
        }}
      >
        <FontAwesomeIcon className="project-card-button" icon={faSignInAlt} onClick={resume} />
        <FontAwesomeIcon className="project-card-button" icon={faTrash} onClick={rm} />
      </div>
    </div>
  )
}

function Home({show, newProject, openProject}) {
  const [folders, setFolders] = useState([])
  const [projects, setProjects] = useState([])
  useEffect(() => {
    if(!show) return
    ls(setFolders)
    getprojects(setProjects)
  }, [show])
  console.log(projects)
  return (
    <div style={show ? {} : {display: 'none'  }}>
      <h1>PIXL</h1>
      <h2>Projects</h2>
      <div className="home-projects">
        {projects.map(proj => <Project
          project={proj}
          resume={() => openProject(proj)}
          rm={() => deleteProject({title: proj.title, date: proj.date}, setProjects)}
        />)}
      </div>
      <h2>Create project from Google Drive</h2>
      <div className="home-folders">
        {folders.map((f) => <DriveFolder 
          file={f}
          createFromSource={() => newProject(f)}
        />)}
      </div>
    </div>
  )
}

function App() {
  const [state, setState] = useState({view: "home", currentProject: undefined})
  const [gapiState, setGapiState] = useState('unloaded')
  useEffect(() => {
    if(!window.gapi) { // ugly hack, find better way
      const interval = setInterval(() =>  {
        if(window.gapi) setGapiState('loaded')
      }, 3000)
      return () => clearInterval(interval) 
    }
    if(window.gapi.client) {
      setGapiState('signedin')
    } else if(gapiState === "loaded") {
      //gapi.auth2.getAuthInstance().signIn()
      console.log("loading Google API...")
      window.gapi.load('client:auth2', initClient(() => {
        window.gapi.auth2.getAuthInstance().signIn()
        //window.gapi.auth2.getAuthInstance().isSignedIn.listen((args) => console.log("state changes", args))
        setGapiState('signedin')
        ReactGA.initialize('')
      }))
    } 
  }, [window.gapi, gapiState])
  const commitFileToProject =  (file) => {
    commitFile(state.currentProject, file, proj => setState(s0 => Object.assign({}, s0, {currentProject: proj})))
  }
  return (
    <div className="app-main">
      <Helmet>
        <script async defer src="https://apis.google.com/js/api.js"
          onLoad={() => {
            window.gapi.load('client:auth2', initClient)
          }} />
      </Helmet>
      <div style={gapiState === 'unloaded' ? {} : {display: 'none'}}>
          <button onClick={() => setGapiState('loaded')}>Sign in</button>
      </div>
      <Home 
        show={state.view === 'home' && gapiState === 'signedin'} 
        openProject={proj => setState({view: 'editor', currentProject: proj})}
        newProject={(file) => {
          setState({view: 'creator', currentProject: file})
        }} 
      />
      <Editor 
        navigateBack={() => setState({view: 'home'})}
        project={state.currentProject}
        commitFileToProject={commitFileToProject}
        show={gapiState === 'signedin' && state.view === 'editor'} 
      />
      <ProjectCreator 
        create={proj => {
          createProject(proj)
          setState({view: 'editor', currentProject: proj})
        }}
        show={state.view === 'creator'} 
        project={state.currentProject} 
      />
    </div>
  )
}

export default App
