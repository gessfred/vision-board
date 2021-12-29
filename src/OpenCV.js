const cv = window.cv

export const CV_COLORS = {
  orange: new cv.Scalar(255, 2555, 0, 255),
  magenta: new cv.Scalar(255, 0, 255, 255),
  cyan: new cv.Scalar(0, 0, 255, 255),
  dodgerblue: new cv.Scalar(0,0,255,255),
  red: new cv.Scalar(255,0,0,255)
}

export function mergeLabel(original, label) {
  if(!original) return {mat: label}
  cv.bitwise_or(label, original.mat, original.mat)
  return original
}

export function toRGBA(x) {
  let rgb = new cv.Mat()
  cv.cvtColor(x, rgb,cv.COLOR_GRAY2RGBA)
  return rgb
}

export function rgbaToGrayscale(x) {
  let grayscale = new cv.Mat()
  cv.cvtColor(x, grayscale, cv.COLOR_RGBA2GRAY)
  return grayscale
}

export function computeThreshold(image, value) {
  let threshold = new cv.Mat()
  cv.threshold(image, threshold, value, 255, cv.THRESH_TOZERO)
  let grayscale = new cv.Mat()
  cv.cvtColor(threshold, grayscale, cv.COLOR_BGR2GRAY)

  threshold.delete()
  return grayscale
}

export function applyComponent(res, labels, k) {
  const index = cv.matFromArray(1, 1, cv.CV_8UC1, [k])
  let component = new cv.Mat()
  cv.compare(labels, index, component, cv.CMP_EQ) //CMP_GT
  cv.bitwise_or(component, res, res)

  index.delete()
  return component
}

export function applyBrush(x, pos, size, color) {
  let brush = toRGBA(cv.Mat.zeros(x.rows, x.cols, cv.CV_8U))
  cv.circle(brush, pos, size, CV_COLORS[color], cv.FILLED)
  cv.bitwise_and(brush, x, x) 

  brush.delete()
  return x
}

export function renderBrush(image, pos, size) {
  cv.circle(image, pos, size, new cv.Scalar(255, 255, 0, 255), 2)
}

export function getCC(threshold) {
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

export function renderControls(image, pos, brushSensitivity) {
  const W = 100
  const pos1 = new cv.Point(pos.x-W/2, pos.y-45)
  const pos2 = new cv.Point(pos.x+W/2, pos.y-48)
  cv.rectangle(image, pos1, pos2, new cv.Scalar(255, 255, 0, 255), 1)
  const pos3 = new cv.Point(pos.x-W/2+W*brushSensitivity/255, pos2.y)
  cv.rectangle(image, pos1, pos3, new cv.Scalar(255, 255, 0, 255), 4)
  
  cv.putText(image, brushSensitivity.toString(), new cv.Point(pos.x - 25, pos.y-55), cv.FONT_HERSHEY_PLAIN, 2, new cv.Scalar(255, 255, 0, 255), 2)
}

export function renderLabels(image, labels) {
  Object.values(labels).forEach((label) => {
    if(!label.mat) return
    cv.bitwise_or(label.mat, image, image)
  })
}

const distance = (p1, p2) => (p1.x - p2.x)*(p1.x - p2.x)+(p1.y - p2.y)*(p1.y - p2.y)

export function nearestNeighbour(point, points) {
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
