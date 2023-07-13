const bn = require("bignumber.js");
const { request, gql } = require('graphql-request');
import axios from "axios"
import bn from "bignumber.js"
import { getFeeTierPercentage } from "./helper"
import { encodePriceSqrt, expandDecimals } from "./math"

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

const Q96 = new bn(2).pow(96)
const mulDiv = (a, b, multiplier) => {
    return a.multipliedBy(b).div(multiplier)
}

const UNISWAP_V3_SUBGRAPH_URL = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3"

const queryUniswap = async (query, variables) => {
    if(variables){
        // 쿼리 요청 및 응답 처리
        const response = await request(UNISWAP_V3_SUBGRAPH_URL, query, variables);
        return response;
    } else{
        // 쿼리 요청 및 응답 처리
        const response = await request(UNISWAP_V3_SUBGRAPH_URL, query);
        return response;
    }
}

const getVolumn24H = async poolAddress => {
    const { poolDayDatas } = await queryUniswap(gql`{
    poolDayDatas(skip: 1, first:3, orderBy: date, orderDirection: desc, where:{pool: "${poolAddress}"}) {
      volumeUSD
    }
  }`)

    const data = poolDayDatas.map(d => Number(d.volumeUSD))

    return data.reduce((result, curr) => result + curr, 0) / data.length
}

const getPoolTicks = async poolAddress => {
    const { ticks } = await queryUniswap(gql`{
    ticks(first: 1000, skip: 0, where: { poolAddress: "${poolAddress}" }, orderBy: tickIdx) {
      tickIdx
      liquidityNet
      price0
      price1
    }
  }`)

    return ticks
}

const getPriceChart = async (
    contractAddress,
    queryPeriod = "30"
) => {
    const token = getToken(contractAddress)

    if (!token) return null

    const marketChartRes = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${token.id}/market_chart?vs_currency=usd&days=${queryPeriod}`
    )
    const currentPriceRes = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${token.id}&vs_currencies=usd`
    )
    const prices = marketChartRes.data.prices.map(d => ({
        timestamp: d[0],
        value: d[1]
    }))

    return {
        tokenId: token.id,
        tokenName: token.name,
        currentPriceUSD: currentPriceRes.data[token.id].usd,
        prices
    }
}


const getPoolFromId = async (poolId) => {
    const variables = {
        poolId,
    };

    const { pools } = await queryUniswap(gql`{
        query pool($poolId: ID!) {
            pool(id: $poolId) {
                id
                tick
                sqrtPrice
                feeTier
                liquidity
                token0Price
                token1Price
                token0{
                  id
                  symbol
                  name
                  decimals
                }
                token1{
                  id
                  symbol
                  name
                  decimals
                }
            }
        }`, variables)

            // 쿼리 변수 정의
    console.log(pools);
    return pools
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

const calculateLiquidity = (ticks, currentTick) => {
    if (ticks.length <= 1) return new bn(0)
    let liquidity = new bn(0)
    for (let i = 0; i < ticks.length - 1; ++i) {
        liquidity = liquidity.plus(new bn(ticks[i].liquidityNet))

        let lowerTick = Number(ticks[i].tickIdx)
        let upperTick = Number(ticks[i + 1].tickIdx)

        if (lowerTick <= currentTick && currentTick <= upperTick) {
            break
        }
    }

    return liquidity
}

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



const main = async () => {
    const poolID = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8"
    const pool = await getPoolFromId(poolID);
    const token0 = pool.token0;
    const token1 = pool.token1;
    const poolTicks = await getPoolTicks(poolID);
    const token0PriceChart = await getPriceChart(token0.id);
    const token1PriceChart = await getPriceChart(token1.id);
    const volume24H = await getVolumn24H(pool.id);

    // pool -> token0Price가 담긴 데이터가 들어가야함
    const price = getPrice(token0PriceChart, token1PriceChart, pool);
    const P = price.currentPrice;
    const Pl = price.priceRangeValue[0];
    const Pu = price.priceRangeValue[1];
    const priceUSDX = token1PriceChart.currentPriceUSD || 1;
    const priceUSDY = token0PriceChart.currentPriceUSD || 1;
    const targetAmounts = 1000;

    const { amount0, amount1 } = getTokenAmountsFromDepositAmounts(
        P,
        Pl,
        Pu,
        priceUSDX,
        priceUSDY,
        targetAmounts
    );

    const sqrtRatioX96 = getSqrtPriceX96(
        P,
        pool.token0.decimals || "18",
        pool.token1.decimals || "18"
    );
    const sqrtRatioAX96 = getSqrtPriceX96(
        Pl,
        pool.token0?.decimals || "18",
        pool.token1?.decimals || "18"
    );
    const sqrtRatioBX96 = getSqrtPriceX96(
        Pu,
        pool.token0?.decimals || "18",
        pool.token1?.decimals || "18"
    );

    const deltaL = getLiquidityForAmounts(
        sqrtRatioX96,
        sqrtRatioAX96,
        sqrtRatioBX96,
        amount0,
        Number(pool.token1.decimals || 18),
        amount1,
        Number(pool.token0.decimals || 18)
    );

    let currentTick = getTickFromPrice(
        P,
        pool.token0.decimals || "18",
        pool.token1.decimals || "18"
    );

    const L = calculateLiquidity(poolTicks || [], currentTick);
    const feeTier = pool.feeTier || "";

    let fee = calculateFee(deltaL, L, volume24H, feeTier);
    if (P < Pl || P > Pu) fee = 0;
    console.log(fee);
}

main();