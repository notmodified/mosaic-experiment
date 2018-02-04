import "./app.scss";
import "babel-polyfill";
import Flickr from "flickr-sdk";
import { range, splitEvery, zipWith, add, compose, reduce, map, into, zip, xprod } from "ramda";
import { fromJS, List } from 'immutable'
import mi from 'mithril'
const M = require("most");
const R = require("ramda");
const gcd = require("gcd")
import { avgColor, avgSquares } from './avgs.js'

import Worker from "worker-loader!./worker.js"
import Sorter from "worker-loader!./sorter.js"
import Color from "worker-loader!./color.js"

// rendering bits
const classes = (used, current) =>
  R.join(' ', [used ? 'used' : '', current ? 'current' : ''])

const spread = (num) => R.clamp(0, 0.2, num/100)

const images = {
  view: ({attrs: {images}}) =>
  R.map(({src, used, current}) =>
    mi('div', {
      'class': classes(used, current),
      'data-used': used,
      'style': used ? `box-shadow: 0 0 0.3rem ${spread(used)}rem rgba(0, 0, 0, 0.6)`:''
    },
      mi('img', {src})), images)
}

const renderBox = (root, state) => {
  mi.render(root, mi(images, {images: R.project(['src', 'used', 'current'], state)}))
}
// end rendering bits
// state bits
let theState = [];
const perPage = 400;
const appendToState = (item) => {
  theState = R.append(item, theState.slice(-perPage+1))
}
const setUsed = (src) => {
  theState = R.map(
    R.cond([
      [R.eqProps('src', {src}), R.evolve({used: R.inc})],
      [R.T, R.identity],
    ]), theState)
}
const setCurrent = (src) => {
  theState = R.map(
    R.compose(
      R.cond([
        [R.eqProps('src', {src}), R.assoc('current', true)],
        [R.T, R.identity],
      ]),
      R.assoc('used', 0),
      R.dissoc('current')
    ), theState)
}
const getState = () => theState
const bySrc = (src) => R.find(R.pathEq(['src'], src), theState)
// state bits

document.addEventListener('DOMContentLoaded', () => {

  const w = new Worker();
  const s = new Sorter();
  const c = new Color();

  const beacon = document.getElementById('bacon');
  const inspector = document.getElementById('inspector');
  const imag = document.getElementById('img');
  const imgBox = document.getElementById('image-box')

  const key = '51a9f6e2f76d707dfbed602811e9d911';

  const api = (q = 'cat') => `https://api.flickr.com/services/rest?method=flickr.photos.search&format=json&nojsoncallback=1&api_key=51a9f6e2f76d707dfbed602811e9d911&safe_search=1&text=${q}&per_page=${perPage}&page=1`;

  const pImageUrl = (s, {farm, server, id, secret}) => `https://farm${farm}.staticflickr.com/${server}/${id}_${secret}_${s}.jpg`;
  const imageUrl = R.curry(pImageUrl)("s")
  const fullImageUrl = R.curry(pImageUrl)("b")

  const avgCanvas = document.createElement("canvas");
  const actx = avgCanvas.getContext("2d");

  const mctx = beacon.getContext("2d");

  const q = document.querySelector('#query')
  const qValue = () => q.value

  const more = M.startWith(
    1,
    M.merge(
      M.fromEvent("click", document.querySelector("button.more")),
      M.fromEvent("keydown", q).filter(({key}) => key === 'Enter')
    )
  )
    .debounce(50)
    .map(qValue)
    .map(api)
    .map(fetch)
    .awaitPromises()
    .map(r => r.json())
    .awaitPromises()
    .map(R.path(["photos", "photo"]))
    .flatMap(M.from)
    .map(i => R.assoc("thumb", imageUrl(i), i))
    .map(i => R.assoc("full", fullImageUrl(i), i))

    .map(i => new Promise(res => {
      const notFound = require('./photo_unavailable.png');
      fetch(i.thumb)
        .then(r => r.blob())
        .then(r => res(R.assoc("thumbBlob", r, i)))
        .catch(e => {
          fetch(notFound)
            .then(r => r.blob())
            .then(r => res(R.assoc("full", notFound, R.assoc("thumbBlob", r, i))))
        })
    }))
    .awaitPromises()

    .map(r => new Promise(res => {
      const img = new Image()
      img.src = URL.createObjectURL(r.thumbBlob)
      img.onload = () => res(R.assoc('src', img.src, R.assoc('img', img, r)))
    }))
    .awaitPromises()
    .observe(i => {
      actx.drawImage(i.img, 0, 0);
      const idata = actx.getImageData(0,0,i.img.width,i.img.height)
      c.postMessage({data: idata, full: i.full, src: i.src}, [idata.data.buffer])
    })


  const freshImages = M.fromEvent('message', c)
    .map(R.compose(appendToState, R.prop('data')))
    .tap(() =>
      s.postMessage({db: R.project(['avgColor', 'src'], getState())})
    )

  const imageChoose = M.fromEvent('click', document.getElementById('image-box'))
    .filter(R.compose(R.test(/IMG/), R.path(['target', 'tagName'])))
    .map(R.path(['target', 'src']))
    .tap((src) => {
      setCurrent(src)
    })
    .map(bySrc)
    .map(i => new Promise((res, rej) => {
      fetch(i.full)
        .then(r => r.blob())
        .then(r => res(R.assoc("fullBlob", r, i)))
    }))
    .awaitPromises()
    .map(r => new Promise(res => {
      const img = new Image()
      img.src = URL.createObjectURL(r.fullBlob)
      img.onload = () => res(R.assoc('fullImg', img, r))
    }))
    .awaitPromises()
    .map(r => {
      beacon.width = r.fullImg.width
      beacon.height = r.fullImg.height
      mctx.clearRect(0, 0, beacon.width, beacon.height);
      mctx.drawImage(r.fullImg, 0, 0, r.fullImg.width, r.fullImg.height)
      return mctx.getImageData(0,0,r.fullImg.width,r.fullImg.height);
    })
    .tap(e => w.postMessage({data:e},[e.data.buffer]))

  M.fromEvent("message", w)
    .flatMap(R.compose(M.from, R.prop('data')))
    .observe(data => {
      mctx.fillStyle = `rgb(${data.avg[0]}, ${data.avg[1]}, ${data.avg[2]})`;
      mctx.fillRect(data.x, data.y, data.w, data.h);

      s.postMessage({q:data.avg, coords: {x:data.x, y:data.y, w:data.w, h:data.h}})
    })

  const placeImage = M.fromEvent("message", s)
    .tap(({data}) => {
      const img = document.querySelector(`img[src="${data.src}"]`)

      setUsed(data.src)

      if (img) {
        const args = R.prepend(img, R.props(['x', 'y', 'w', 'h'], data.coords))
        mctx.drawImage(...args)
      }
    })

  M.merge(placeImage.debounce(2), freshImages.debounce(5), imageChoose)
    .observe(() => renderBox(imgBox, getState()));

});
