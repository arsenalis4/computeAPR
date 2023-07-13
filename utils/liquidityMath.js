const { getFeeTierPercentage } = require("./helper");
const { encodePriceSqrt, expandDecimals } = require("./math");
const bn = require("bignumber.js");

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

const Q96 = new bn(2).pow(96)
const mulDiv = (a, b, multiplier) => {
    return a.multipliedBy(b).div(multiplier)
}

const getTickFromPrice = (price, token0Decimal, token1Decimal) => {
    const token0 = expandDecimals(price, Number(token0Decimal))
    const token1 = expandDecimals(1, Number(token1Decimal))
    const sqrtPrice = mulDiv(
        encodePriceSqrt(token1),
        Q96,
        encodePriceSqrt(token0)
    ).div(new bn(2).pow(96))

    return Math.log(sqrtPrice.toNumber()) / Math.log(Math.sqrt(1.0001))
}


// for calculation detail, please visit README.md (Section: Calculation Breakdown, No. 1)
const getTokenAmountsFromDepositAmounts = (
    P,
    Pl,
    Pu,
    priceUSDX,
    priceUSDY,
    targetAmounts
) => {
    const deltaL =
        targetAmounts /
        ((Math.sqrt(P) - Math.sqrt(Pl)) * priceUSDY +
            (1 / Math.sqrt(P) - 1 / Math.sqrt(Pu)) * priceUSDX)

    let deltaY = deltaL * (Math.sqrt(P) - Math.sqrt(Pl))
    if (deltaY * priceUSDY < 0) deltaY = 0
    if (deltaY * priceUSDY > targetAmounts) deltaY = targetAmounts / priceUSDY

    let deltaX = deltaL * (1 / Math.sqrt(P) - 1 / Math.sqrt(Pu))
    if (deltaX * priceUSDX < 0) deltaX = 0
    if (deltaX * priceUSDX > targetAmounts) deltaX = targetAmounts / priceUSDX

    return { amount0: deltaX, amount1: deltaY }
}

const getSqrtPriceX96 = (price, token0Decimal, token1Decimal) => {
    const token0 = expandDecimals(price, Number(token0Decimal))
    const token1 = expandDecimals(1, Number(token1Decimal))
    // return mulDiv(encodePriceSqrt(token1), Q96, encodePriceSqrt(token0)).div(
    //   new bn(2).pow(96)
    // );
    return token0
        .div(token1)
        .sqrt()
        .multipliedBy(new bn(2).pow(96))
}

const getLiquidityForAmounts = (
    sqrtRatioX96,
    sqrtRatioAX96,
    sqrtRatioBX96,
    _amount0,
    amount0Decimal,
    _amount1,
    amount1Decimal
) => {
    const amount0 = expandDecimals(_amount0, amount0Decimal)
    const amount1 = expandDecimals(_amount1, amount1Decimal)

    let liquidity
    if (sqrtRatioX96.lte(sqrtRatioAX96)) {
        liquidity = getLiquidityForAmount0(sqrtRatioAX96, sqrtRatioBX96, amount0)
    } else if (sqrtRatioX96.lt(sqrtRatioBX96)) {
        const liquidity0 = getLiquidityForAmount0(
            sqrtRatioX96,
            sqrtRatioBX96,
            amount0
        )
        const liquidity1 = getLiquidityForAmount1(
            sqrtRatioAX96,
            sqrtRatioX96,
            amount1
        )

        liquidity = bn.min(liquidity0, liquidity1)
    } else {
        liquidity = getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1)
    }

    return liquidity
}

// for calculation detail, please visit README.md (Section: Calculation Breakdown, No. 2)
const getLiquidityForAmount0 = (sqrtRatioAX96, sqrtRatioBX96, amount0) => {
    // amount0 * (sqrt(upper) * sqrt(lower)) / (sqrt(upper) - sqrt(lower))
    const intermediate = mulDiv(sqrtRatioBX96, sqrtRatioAX96, Q96)
    return mulDiv(amount0, intermediate, sqrtRatioBX96.minus(sqrtRatioAX96))
}

const getLiquidityForAmount1 = (sqrtRatioAX96, sqrtRatioBX96, amount1) => {
    // amount1 / (sqrt(upper) - sqrt(lower))
    return mulDiv(amount1, Q96, sqrtRatioBX96.minus(sqrtRatioAX96))
}

const calculateFee = (
    liquidityDelta,
    liquidity,
    volume24H,
    _feeTier
) => {
    const feeTier = getFeeTierPercentage(_feeTier)
    const liquidityPercentage = liquidityDelta
        .div(liquidity.plus(liquidityDelta))
        .toNumber()

    return feeTier * volume24H * liquidityPercentage
}

module.exports = { getTickFromPrice, getTokenAmountsFromDepositAmounts, getSqrtPriceX96, getLiquidityForAmounts, calculateFee}