import { range, splitEvery, zipWith, add, compose, reduce, map, into, zip, xprod } from "ramda";
const M = require("most");
const R = require("ramda");

const distance = R.curry((c1, c2) => {
  return Math.abs(
    Math.pow((c2[0] - c1[0])|0 ,2) + Math.pow((c2[1] - c1[1])|0,2) + Math.pow((c2[2] - c1[2])|0, 2)
  )
})

let odb = [];

onmessage = ({data}) => {
  if (data.db) {
    odb = data.db;
  } else if(data.q) {
    const d = R.compose(distance(data.q), R.prop("avgColor"))
    const rd = R.compose(R.gt(2000), d)
    const matches = R.compose(R.sortBy(d), R.filter(rd))(odb)

    const r = R.head(matches)

    if (r) {
      r.coords = data.coords
      postMessage(r)
    }
  }
}
