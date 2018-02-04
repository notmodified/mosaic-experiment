import { range, splitEvery, zipWith, add, compose, reduce, map, into, zip, xprod } from "ramda";
const M = require("most");
const R = require("ramda");
import { fromJS, List } from 'immutable'

const distance = R.curry((c1, c2) => {
  return Math.abs(
    Math.pow((c2[0] - c1[0])|0 ,2) + Math.pow((c2[1] - c1[1])|0,2) + Math.pow((c2[2] - c1[2])|0, 2)
  )
})

let odb = [];

onmessage = ({data}) => {
  if (data.db) {
    odb = List(data.db)
  } else if(data.q) {
    const d = R.compose(distance(data.q), R.prop("avgColor"))
    const rd = d//R.compose(R.gt(3000), d)
    //const matches = R.compose(R.sortBy(d), R.filter(rd))(odb)
    const matches = odb.filter(rd).sortBy(d)

    //const r = R.head(matches)
    const r = matches.first()

    if (r) {
      r.coords = data.coords
      postMessage(r)
    }
  }
}
