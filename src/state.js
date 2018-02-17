const R = require("ramda");

let theState = [];

export const appendToState = (perPage, item) => {
  theState = R.append(item, theState.slice(-perPage + 1));
};

export const setUsed = src => {
  theState = R.map(
    R.cond([
      [R.eqProps("src", { src }), R.evolve({ used: R.inc })],
      [R.T, R.identity]
    ]),
    theState
  );
};

export const setCurrent = src => {
  theState = R.map(
    R.compose(
      R.cond([
        [R.eqProps("src", { src }), R.assoc("current", true)],
        [R.T, R.identity]
      ]),
      R.assoc("used", 0),
      R.dissoc("current")
    ),
    theState
  );
};

export const getState = () => theState;

export const bySrc = src => R.find(R.pathEq(["src"], src), theState);

let l = 0;

export const setLoading = n => (l = n);

export const decLoading = () => (l -= 1);

export const getLoading = () => l;
