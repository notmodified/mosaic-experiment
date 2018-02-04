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

document.addEventListener('DOMContentLoaded', () => {

  const w = new Worker();
  const s = new Sorter();
  const c = new Color();

  const beacon = document.getElementById('bacon');
  const inspector = document.getElementById('inspector');
  const imag = document.getElementById('img');

  const key = '51a9f6e2f76d707dfbed602811e9d911';

  const perPage = 400;

  const api = () => `https://api.flickr.com/services/rest?method=flickr.photos.search&format=json&nojsoncallback=1&api_key=51a9f6e2f76d707dfbed602811e9d911&safe_search=1&text=something&per_page=${perPage}&page=1`;

  const pImageUrl = (s, {farm, server, id, secret}) => `https://farm${farm}.staticflickr.com/${server}/${id}_${secret}_${s}.jpg`;
  const imageUrl = R.curry(pImageUrl)("s")
  const fullImageUrl = R.curry(pImageUrl)("b")

  const avgCanvas = document.createElement("canvas");
  const actx = avgCanvas.getContext("2d");

  const mctx = beacon.getContext("2d");

  let theState = [];

  const more = M.startWith(
    1,
    M.fromEvent("click", document.querySelector("button.more"))
  )
    .debounce(50)
    .map(api)
    .map(fetch)
    .awaitPromises()
    .map(r => r.json())
    .awaitPromises()
    .map(R.path(["photos", "photo"]))
  //  .scan((acc, e) => acc.concat(e).slice(-perPage + 1), [])
    .flatMap(M.from)
    .map(i => R.assoc("thumb", imageUrl(i), i))
    .map(i => R.assoc("full", fullImageUrl(i), i))

    .map(i => new Promise(res => {
      fetch(i.thumb)
        .then(r => r.blob())
        .then(r => res(R.assoc("thumbBlob", r, i)))
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

  const freshImages = M.fromEvent('message', c).map(({data}) => {
    theState = R.append(data, theState.slice(-perPage+1))
    s.postMessage({db: R.project(['avgColor', 'src'], theState)})
    // this would have to just send one, but that would
    // mean the other end had to loose them, jusr slice
    // would do i guess
  })


  // here we combine? with a scan acc from above
  //
  M.fromEvent('click', document.getElementById('image-box'))
    .filter(R.compose(R.test(/IMG/), R.path(['target', 'tagName'])))
    .debounce(50)
    .map(R.path(['target', 'src']))
    .tap((src) => {
      theState = R.map(
        R.compose(
          R.cond([
            [R.eqProps('src', {src}), R.assoc('current', true)],
            [R.T, R.identity],
          ]),
          R.dissoc('used'),
          R.dissoc('current')
        ), theState)
    })
    .map(e => R.find(R.pathEq(['src'], e), theState))
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
    .observe(e => w.postMessage({data:e},[e.data.buffer]))

  M.fromEvent("message", w)
    .flatMap(R.compose(M.from, R.prop('data')))
    .observe(data => {
      mctx.fillStyle = `rgb(${data.avg[0]}, ${data.avg[1]}, ${data.avg[2]})`;
      mctx.fillRect(data.x, data.y, data.w, data.h);

      s.postMessage({q:data.avg, coords: {x:data.x, y:data.y, w:data.w, h:data.h}})
    })

  const placeImage = M.fromEvent("message", s)
    .map(({data}) => {
      const img = document.querySelector(`img[src="${data.src}"]`)

      theState = R.map(
        R.cond([
          [R.eqProps('src', data), R.assoc('used', true)],
          [R.T, R.identity],
        ]), theState)

      if (img) {
        const args = R.prepend(img, R.props(['x', 'y', 'w', 'h'], data.coords))
        mctx.drawImage(...args)
      }
    })

  const imgBox = document.getElementById('image-box')

  const classes = (used, current) =>
    R.join(' ', [used ? 'used' : '', current ? 'current' : ''])

  const images = {
    view: ({attrs: {images}}) =>
      R.map(({src, used, current}) =>
        mi('img', {src, 'class': classes(used, current)}), images)
  }

  const renderBox = () => {
    mi.render(imgBox, mi(images, {images: R.project(['src', 'used', 'current'], theState)}))
  }

  M.merge(placeImage.debounce(50), freshImages.debounce(5))
    .observe(renderBox);

});
