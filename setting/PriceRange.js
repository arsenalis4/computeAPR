const { divideArray, findMax, findMin } = require("../utils/math")

const getPrice = (token0PriceChart, token1PriceChart, pool) => {
    const prices = divideArray(
        (token1PriceChart.prices || []).map(p => p.value),
        (token0PriceChart.prices || []).map(p => p.value)
    )

    const currentPrice = Number(pool.token0Price || NaN)

    let _min = findMin(prices)
    let _max = findMax(prices)
    if (token0PriceChart === null || token1PriceChart === null) {
        _min = currentPrice - currentPrice * 0.3
        _max = currentPrice + currentPrice * 0.3
    }

    return ({
        currentPrice: currentPrice,
        priceRangeValue: [_min, _max]
    })
}

module.exports = { getPrice };