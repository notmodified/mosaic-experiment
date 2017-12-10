import "./app.scss";
import Flickr from "flickr-sdk";
import { range, splitEvery, zipWith, add, compose, reduce, map, into, zip, xprod } from "ramda";

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

document.addEventListener('DOMContentLoaded', () => {
  const beacon = document.getElementById('bacon');
  const inspector = document.getElementById('inspector');
  const imag = document.getElementById('img');

  const key = '51a9f6e2f76d707dfbed602811e9d911';

  fetch('https://api.flickr.com/services/rest?method=flickr.photos.getRecent&format=json&nojsoncallback=1&api_key=51a9f6e2f76d707dfbed602811e9d911')
    .then(r => {
      if(r.ok) {
        return r.json();
      }
      throw new Error('Network response was not ok.');
    })
    .then(r => {
      const i = r.photos.photo[getRandomInt(0, r.photos.photo.length)];

      fetch(`https://farm${i.farm}.staticflickr.com/${i.server}/${i.id}_${i.secret}_s.jpg`)
        .then(r => {
          if (r.ok) {
            return r.blob()
          }
      throw new Error('Network response was not ok.');
        })
        .then(r => {
          var objectURL = URL.createObjectURL(r);
          var ctx = beacon.getContext("2d");
          ctx.imageSmoothingEnabled =
            ctx.mozImageSmoothingEnabled =
            ctx.msImageSmoothingEnabled =
            ctx.webkitImageSmoothingEnabled = false;
          ctx.clearRect(0, 0, beacon.width, beacon.height);
          const ictx = inspector.getContext("2d");
          ictx.clearRect(0, 0, inspector.width, inspector.height);
          const img = new Image();
          img.onload = () => {
            const w = (img.width /8) |0;
            const h = (img.height/8) |0;
            ctx.drawImage(img, 0, 0, w, h);
            ctx.drawImage(beacon, 0, 0, w, h, 0, 0, beacon.width, beacon.height)

            const step = d => x => x+(d*x);
            const steps = x => map(step(beacon.width/x), range(0, x));
            const getColors = map(([x, y]) => [x, y, ctx.getImageData(x, y, 1, 1).data])

            const points = getColors(xprod(steps(w), steps(h)));

            (points).forEach(e => {
              ctx.fillText(e[2], e[0], e[1]+10);
            });

            ictx.drawImage(img, 0, 0);
            const idata = ictx.getImageData(0,0,img.width,img.height);

            const t = data =>
              compose(
                map(x => x/(data.length/4)|0),
                reduce(zipWith(add), [0, 0, 0, 0]),
                splitEvery(4)
              )(data);

            const rgba = t(idata.data);

            document.body.style.backgroundColor = 'rgba(' + rgba.join(', ') + ')';
          };
          img.src = imag.src = objectURL;

        }).catch(e => {
          console.log('There has been a problem with your fetch operation: ' + e.message);
        });

    });
});
