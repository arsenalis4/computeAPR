const bn = require('bignumber.js');
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

const encodePriceSqrt = price => {
  return new bn(price)
    .sqrt()
    .multipliedBy(new bn(2).pow(96))
    .integerValue(3)
}

function expandDecimals(n, exp) {
  return new bn(n).multipliedBy(new bn(10).pow(exp))
}

const calculateAvg = data => {
  return data.reduce((result, val) => result + val, 0) / data.length
}

const findMax = data => {
  return data.reduce((max, val) => (max > val ? max : val), 0)
}

const findMin = data => {
  return data.reduce(
    (min, val) => (min > val ? val : min),
    Number.MAX_SAFE_INTEGER
  )
}

const divideArray = (data0, data1) => {
  const result = []
  data0.forEach((d, i) => {
    result[i] = d / data1[i]
    if (isNaN(result[i])) result[i] = result[i - 1]
  })
  return result
}

module.exports = { encodePriceSqrt, expandDecimals, calculateAvg, findMax, findMin, divideArray };