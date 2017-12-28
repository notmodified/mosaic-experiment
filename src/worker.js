import { avgColor, avgSquares } from './avgs.js'

onmessage = e => {
  postMessage(avgSquares(e.data.data.width, e.data.data.height, e.data.data.data))
}
